import { describe, expect, test } from "bun:test";

import { loadMinikmsGrpcCredentials } from "@/libs/kms/grpc-credentials";
import { MinikmsTlsError } from "@/libs/kms/tls-policy";
import { env } from "@/utils/env";

describe("miniKMS TLS", () => {
	test("refuses a non-TLS miniKMS connection outside development", () => {
		expect(() => loadMinikmsGrpcCredentials({
			NODE_ENV: "production",
			MINIKMS_TLS_ENABLED: "false",
			MINIKMS_TLS_INSECURE: "true",
		})).toThrow(MinikmsTlsError);

		try {
			loadMinikmsGrpcCredentials({
				NODE_ENV: "production",
				MINIKMS_TLS_ENABLED: "false",
			});
			throw new Error("expected the API to refuse a non-TLS miniKMS connection");
		} catch (error) {
			expect(error).toBeInstanceOf(MinikmsTlsError);
			expect((error as Error).message).toContain("non-TLS miniKMS connection");
		}
	});

	test("refuses startup outside development when miniKMS TLS is not configured", () => {
		const parsed = env.safeParse({
			...process.env,
			NODE_ENV: "production",
			API_URL: "https://api.example.com",
			MINIKMS_TLS_ENABLED: "false",
			MINIKMS_TLS_INSECURE: "false",
		});
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			const messages = parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("\n");
			expect(messages).toContain("non-TLS miniKMS connection");
		}
	});

	test("allows a plaintext miniKMS connection only with the development opt-in", () => {
		const insecure = loadMinikmsGrpcCredentials({
			NODE_ENV: "development",
			MINIKMS_TLS_ENABLED: "false",
			MINIKMS_TLS_INSECURE: "true",
		});
		expect(insecure._isSecure()).toBe(false);
		expect(() => loadMinikmsGrpcCredentials({
			NODE_ENV: "development",
			MINIKMS_TLS_ENABLED: "false",
		})).toThrow(MinikmsTlsError);
	});
});
