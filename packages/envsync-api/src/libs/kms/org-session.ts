export const MINIKMS_BOOTSTRAP_SESSION_HEADER = "x-minikms-bootstrap-session";
export const MINIKMS_BOOTSTRAP_MEMBER_SERIAL_HEADER = "x-minikms-member-serial";

export interface OrgBootstrapSession {
	token: string;
	memberSerial: string;
}

interface MetadataLookup {
	get(name: string): Array<string | Buffer>;
}

const sessions = new Map<string, OrgBootstrapSession>();

function metadataValue(metadata: MetadataLookup, name: string): string {
	const value = metadata.get(name)[0];
	if (typeof value === "string") {
		return value.trim();
	}
	if (value) {
		return value.toString("utf8").trim();
	}
	return "";
}

/**
 * Read the one-time admin session CreateOrgCA returns in response headers.
 * An empty token means the organization already existed and no session was minted.
 */
export function bootstrapSessionFromMetadata(metadata: MetadataLookup | undefined): OrgBootstrapSession | undefined {
	if (!metadata) {
		return undefined;
	}
	const token = metadataValue(metadata, MINIKMS_BOOTSTRAP_SESSION_HEADER);
	if (!token) {
		return undefined;
	}
	return {
		token,
		memberSerial: metadataValue(metadata, MINIKMS_BOOTSTRAP_MEMBER_SERIAL_HEADER),
	};
}

/** Remember a session for this process. A blank token does not replace a stored one. */
export function rememberOrgBootstrapSession(orgId: string, token: string, memberSerial: string): boolean {
	if (!orgId || !token.trim()) {
		return false;
	}
	sessions.set(orgId, { token, memberSerial });
	return true;
}

export function peekOrgBootstrapSession(orgId: string): OrgBootstrapSession | undefined {
	return sessions.get(orgId);
}

export async function orgBootstrapSession(orgId: string): Promise<OrgBootstrapSession | undefined> {
	if (!orgId) {
		return undefined;
	}
	const cached = sessions.get(orgId);
	if (cached) {
		return cached;
	}
	try {
		const store = await import("./org-session-store");
		const loaded = await store.loadOrgBootstrapSession(orgId);
		if (!loaded?.token) {
			return undefined;
		}
		sessions.set(orgId, loaded);
		return loaded;
	} catch {
		return undefined;
	}
}

export async function saveOrgBootstrapSession(orgId: string): Promise<void> {
	const session = sessions.get(orgId);
	if (!session) {
		return;
	}
	const store = await import("./org-session-store");
	await store.saveOrgBootstrapSession(orgId, session);
}
