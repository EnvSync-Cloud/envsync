import { mkdirSync, writeFileSync } from "node:fs";

import { getArtifactPath, getUiHarnessConfig } from "./config";

export interface InboxMessageRef {
	id: string;
	subject?: string;
	raw: Record<string, unknown>;
}

export interface InviteLink {
	url: string;
	kind: "org" | "user";
	messageId: string;
	recipient: string;
}

export interface MailpitAdapter {
	listMessages(): Promise<InboxMessageRef[]>;
	waitForInviteLink(recipient: string, kind?: InviteLink["kind"]): Promise<InviteLink>;
}

const INVITE_PATTERNS = {
	// Path is shared across landing (Hosted) and dashboard (self-host Phase 2).
	org: /https?:\/\/[^\s"'<>]+\/onboarding\/accept-org-invite\/[A-Za-z0-9_-]+/i,
	user: /https?:\/\/[^\s"'<>]+\/onboarding\/accept-user-invite\/[A-Za-z0-9_-]+/i,
};

function ensureArtifactDir() {
	mkdirSync(getArtifactPath("mailpit"), { recursive: true });
}

function normalizeRecipient(value: string) {
	return value.trim().toLowerCase();
}

function collectStrings(input: unknown, values: string[] = []): string[] {
	if (typeof input === "string") {
		values.push(input);
		return values;
	}

	if (Array.isArray(input)) {
		for (const entry of input) {
			collectStrings(entry, values);
		}
		return values;
	}

	if (input && typeof input === "object") {
		for (const value of Object.values(input)) {
			collectStrings(value, values);
		}
	}

	return values;
}

function recipientMatches(message: Record<string, unknown>, recipient: string) {
	const needle = normalizeRecipient(recipient);
	return collectStrings(message).some(value => value.toLowerCase().includes(needle));
}

async function fetchJson<T>(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Mailpit request failed: ${response.status} ${response.statusText} for ${url}`);
	}
	return response.json() as Promise<T>;
}

async function fetchMessageDetail(messageId: string) {
	const { mailpitUrl } = getUiHarnessConfig();
	const candidates = [
		`${mailpitUrl}/api/v1/message/${messageId}`,
		`${mailpitUrl}/api/v1/messages/${messageId}`,
	];

	for (const url of candidates) {
		try {
			return await fetchJson<Record<string, unknown>>(url);
		} catch {
			// Try the next endpoint shape.
		}
	}

	throw new Error(`Unable to fetch Mailpit message detail for ${messageId}`);
}

function extractInviteFromMessage(
	messageId: string,
	recipient: string,
	message: Record<string, unknown>,
	kind?: InviteLink["kind"],
): InviteLink | null {
	const haystack = collectStrings(message).join("\n");

	if (kind) {
		const match = haystack.match(INVITE_PATTERNS[kind]);
		if (!match) return null;
		return { url: match[0], kind, messageId, recipient };
	}

	for (const [nextKind, pattern] of Object.entries(INVITE_PATTERNS) as Array<[InviteLink["kind"], RegExp]>) {
		const match = haystack.match(pattern);
		if (match) {
			return { url: match[0], kind: nextKind, messageId, recipient };
		}
	}

	return null;
}

async function writeInboxSnapshot(recipient: string, payload: unknown) {
	ensureArtifactDir();
	const safeRecipient = recipient.replace(/[^a-zA-Z0-9._-]+/g, "_");
	const filePath = getArtifactPath("mailpit", `${safeRecipient}-${Date.now()}.json`);
	writeFileSync(filePath, JSON.stringify(payload, null, 2));
	return filePath;
}

export class LocalMailpitAdapter implements MailpitAdapter {
	async listMessages(): Promise<InboxMessageRef[]> {
		const { mailpitUrl } = getUiHarnessConfig();
		const payload = await fetchJson<{ messages?: Array<Record<string, unknown>> }>(`${mailpitUrl}/api/v1/messages`);
		return (payload.messages ?? []).map((message, index) => {
			const id = String(message.ID ?? message.id ?? message.MessageID ?? index);
			return {
				id,
				subject: String(message.Subject ?? message.subject ?? ""),
				raw: message,
			};
		});
	}

	async waitForInviteLink(recipient: string, kind?: InviteLink["kind"]): Promise<InviteLink> {
		const config = getUiHarnessConfig();
		const startedAt = Date.now();
		let lastInboxPayload: unknown = null;

		while (Date.now() - startedAt < config.mailpitPollTimeoutMs) {
			const inboxPayload = await fetchJson<Record<string, unknown>>(`${config.mailpitUrl}/api/v1/messages`);
			lastInboxPayload = inboxPayload;
			const messages = Array.isArray(inboxPayload.messages) ? inboxPayload.messages : [];

			for (const message of messages) {
				if (!recipientMatches(message as Record<string, unknown>, recipient)) {
					continue;
				}

				const messageId = String(
					(message as Record<string, unknown>).ID ??
					(message as Record<string, unknown>).id ??
					(message as Record<string, unknown>).MessageID,
				);
				if (!messageId) {
					continue;
				}

				const detail = await fetchMessageDetail(messageId);
				const invite = extractInviteFromMessage(messageId, recipient, detail, kind);
				if (invite) {
					return invite;
				}
			}

			await new Promise(resolve => setTimeout(resolve, config.mailpitPollIntervalMs));
		}

		const snapshotPath = await writeInboxSnapshot(recipient, lastInboxPayload);
		throw new Error(
			`Timed out waiting for ${kind ?? "invite"} email for ${recipient}. Inbox snapshot: ${snapshotPath}`,
		);
	}
}

export const mailpit = new LocalMailpitAdapter();
