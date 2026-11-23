/**
 * Carries the caller's original DPoP header and access token from the
 * authenticated request onto miniKMS gRPC metadata.
 *
 * The values are copied unchanged. Call metadata is only:
 *   x-envsync-dpop          inbound DPoP header value
 *   x-envsync-access-token  inbound access token with one scheme prefix removed
 * plus the existing vault-session authorization header when that call already
 * sends one. No mode field is added.
 */
import { AsyncLocalStorage } from "node:async_hooks";

import * as grpc from "@grpc/grpc-js";

/** Inbound `DPoP` header value, byte-for-byte. */
export const FORWARDED_DPOP_METADATA_KEY = "x-envsync-dpop";

/** Inbound access token with one `DPoP ` / `Bearer ` prefix removed, byte-for-byte. */
export const FORWARDED_ACCESS_TOKEN_METADATA_KEY = "x-envsync-access-token";

const FORBIDDEN_METADATA_KEY = /(?:^|[-_])(?:mode|skip)(?:$|[-_])|dpop[-_]?mode|dpop[-_]?skip/i;

export interface InboundKmsProof {
	/** Raw DPoP header value. Null when the request did not send the header. */
	readonly dpop: string | null;
	/** Atrium access token without one scheme prefix. Null when this request has none. */
	readonly accessToken: string | null;
}

const requestProof = new AsyncLocalStorage<InboundKmsProof>();

/** Remove one leading `Bearer ` or `DPoP ` prefix. The remainder is unchanged. */
export function stripAuthScheme(value: string): string {
	const match = /^(?:Bearer|DPoP) ([\s\S]*)$/i.exec(value);
	return match ? match[1] : value;
}

export function captureInboundKmsProof(input: {
	dpopHeader: string | undefined;
	/** Resolved Authorization value or access-token cookie. Null when it is not an Atrium access token. */
	credential: string | null;
}): InboundKmsProof {
	const stripped = input.credential === null ? null : stripAuthScheme(input.credential);
	return {
		dpop: input.dpopHeader === undefined ? null : input.dpopHeader,
		accessToken: stripped === null || stripped.length === 0 ? null : stripped,
	};
}

export function runWithInboundKmsProof<T>(proof: InboundKmsProof, fn: () => T): T {
	return requestProof.run(proof, fn);
}

export function currentInboundKmsProof(): InboundKmsProof | undefined {
	return requestProof.getStore();
}

export function assertForwardableMetadata(metadata: grpc.Metadata): void {
	for (const key of Object.keys(metadata.getMap())) {
		if (FORBIDDEN_METADATA_KEY.test(key)) {
			throw new Error(`Unexpected miniKMS call metadata key: ${key}`);
		}
	}
}

/** Metadata for one miniKMS unary call. Copies the inbound proof when the request has one. */
export function buildMinikmsCallMetadata(sessionToken?: string): grpc.Metadata {
	const metadata = new grpc.Metadata();
	if (sessionToken) {
		metadata.set("authorization", `Bearer ${sessionToken}`);
	}
	const proof = requestProof.getStore();
	if (proof?.dpop !== null && proof?.dpop !== undefined) {
		metadata.set(FORWARDED_DPOP_METADATA_KEY, proof.dpop);
	}
	if (proof?.accessToken) {
		metadata.set(FORWARDED_ACCESS_TOKEN_METADATA_KEY, proof.accessToken);
	}
	assertForwardableMetadata(metadata);
	return metadata;
}

type UnaryInvoker = (
	request: Record<string, unknown>,
	metadata: grpc.Metadata,
	options: { deadline: Date },
	callback: (err: grpc.ServiceError | null, response: unknown) => void,
) => { on?: (event: "metadata", listener: (metadata: grpc.Metadata) => void) => void } | void;

/**
 * Unary miniKMS call. Every KMS, vault, PKI, and session RPC goes through here
 * so the inbound proof is attached in one place.
 */
export function dispatchMinikmsUnary<TRes>(
	stub: grpc.Client,
	method: string,
	request: Record<string, unknown>,
	timeoutMs = 10_000,
	sessionToken?: string,
	onMetadata?: (metadata: grpc.Metadata) => void,
): Promise<TRes> {
	return new Promise<TRes>((resolve, reject) => {
		try {
			const deadline = new Date(Date.now() + timeoutMs);
			const metadata = buildMinikmsCallMetadata(sessionToken);
			const invoke = (stub as unknown as Record<string, UnaryInvoker>)[method];
			if (typeof invoke !== "function") {
				reject(new Error(`miniKMS method ${method} is not available`));
				return;
			}
			const call = invoke.call(
				stub,
				request,
				metadata,
				{ deadline },
				(err: grpc.ServiceError | null, response: unknown) => {
					if (err) reject(err);
					else resolve(response as TRes);
				},
			);
			call?.on?.("metadata", incoming => {
				onMetadata?.(incoming);
			});
		} catch (error) {
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
}
