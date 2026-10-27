import { config } from "@/utils/env";

const internalBase = () => config.ATRIUM_INTERNAL_URL.replace(/\/$/, "");
const publicBase = () => config.ATRIUM_PUBLIC_URL.replace(/\/$/, "");
const issuer = () => config.ATRIUM_ISSUER.replace(/\/$/, "");

export const getIdentityInternalBaseUrl = () => internalBase();
export const getIdentityPublicBaseUrl = () => publicBase();
export const getIdentityIssuer = () => issuer();

export interface IdentityTokenSet {
	id_token?: string;
	access_token: string;
	refresh_token?: string;
	scope?: string;
	expires_in?: number;
	refresh_expires_in?: number;
	token_type?: string;
}

export interface DirectoryUserCreate {
	userName: string;
	email: string;
	firstName: string;
	lastName: string;
	password?: string;
	passwordEnabled?: boolean;
}

export interface DirectoryUserRecord {
	id: string;
	username?: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	enabled?: boolean;
	hasPassword?: boolean;
}

interface AtriumUser {
	id: string;
	username?: string;
	email?: string;
	given_name?: string;
	family_name?: string;
	disabled?: boolean;
	has_password?: boolean;
}

let managementTokenCache: { accessToken: string; expiresAt: number } | null = null;

function ensureNonEmptyName(value: string, fallback: string): string {
	const trimmed = String(value ?? "").trim();
	return trimmed.length > 0 ? trimmed.slice(0, 255) : fallback;
}

function mapUser(user: AtriumUser): DirectoryUserRecord {
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		firstName: user.given_name,
		lastName: user.family_name,
		enabled: user.disabled !== true,
		hasPassword: user.has_password === true,
	};
}

async function managementToken(): Promise<string> {
	if (managementTokenCache && managementTokenCache.expiresAt > Date.now() + 30_000) {
		return managementTokenCache.accessToken;
	}

	const body = new URLSearchParams({
		grant_type: "client_credentials",
		client_id: config.ATRIUM_MANAGEMENT_CLIENT_ID,
		client_secret: config.ATRIUM_MANAGEMENT_CLIENT_SECRET,
		scope: "management",
	});
	const res = await fetch(`${internalBase()}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) {
		throw new Error(`Atrium management token request failed: ${res.status} ${await res.text()}`);
	}
	const data = (await res.json()) as { access_token: string; expires_in: number };
	managementTokenCache = {
		accessToken: data.access_token,
		expiresAt: Date.now() + data.expires_in * 1000,
	};
	return data.access_token;
}

async function managementFetch(path: string, options: RequestInit = {}) {
	const token = await managementToken();
	return fetch(`${internalBase()}/api${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...(options.headers as Record<string, string> | undefined),
		},
		signal: options.signal ?? AbortSignal.timeout(10_000),
	});
}

async function readUserResponse(res: Response): Promise<DirectoryUserRecord | null> {
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`Atrium user request failed: ${res.status} ${await res.text()}`);
	}
	return mapUser((await res.json()) as AtriumUser);
}

export async function getDirectoryUserById(userId: string): Promise<DirectoryUserRecord | null> {
	return readUserResponse(await managementFetch(`/users/${encodeURIComponent(userId)}`));
}

export async function findDirectoryUserByUsername(username: string): Promise<DirectoryUserRecord | null> {
	const res = await managementFetch(`/users?username=${encodeURIComponent(username)}`);
	if (!res.ok) {
		throw new Error(`Atrium user lookup failed: ${res.status} ${await res.text()}`);
	}
	const users = (await res.json()) as AtriumUser[];
	const match = users.find(user => user.username === username) ?? null;
	return match ? mapUser(match) : null;
}

export async function directoryUserHasPassword(userId: string): Promise<boolean> {
	const user = await getDirectoryUserById(userId);
	return user?.hasPassword === true;
}

export async function createDirectoryUser(payload: DirectoryUserCreate) {
	const withPassword = payload.passwordEnabled !== false && Boolean(payload.password);
	const body: Record<string, unknown> = {
		username: payload.userName,
		email: payload.email,
		email_verified: true,
		given_name: ensureNonEmptyName(payload.firstName, "User"),
		family_name: ensureNonEmptyName(payload.lastName, "-"),
	};
	if (withPassword && payload.password) {
		body.password = payload.password;
	} else {
		body.migration_pending = payload.passwordEnabled !== false;
	}

	const res = await managementFetch("/users", {
		method: "POST",
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`Atrium create user failed: ${res.status} ${await res.text()}`);
	}
	const created = mapUser((await res.json()) as AtriumUser);
	if (!created.id) throw new Error("Atrium create user succeeded but no user id was returned");
	return { id: created.id };
}

export async function updateDirectoryUser(
	userId: string,
	payload: { firstName?: string; lastName?: string; email?: string },
) {
	const body: Record<string, string> = {};
	if (payload.email !== undefined) body.email = payload.email;
	if (payload.firstName !== undefined) body.given_name = ensureNonEmptyName(payload.firstName, "User");
	if (payload.lastName !== undefined) body.family_name = ensureNonEmptyName(payload.lastName, "-");
	const res = await managementFetch(`/users/${encodeURIComponent(userId)}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`Atrium update user failed: ${res.status} ${await res.text()}`);
	}
}

export async function deleteDirectoryUser(userId: string) {
	const res = await managementFetch(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
	if (!res.ok && res.status !== 404) {
		throw new Error(`Atrium delete user failed: ${res.status} ${await res.text()}`);
	}
}

export async function sendDirectoryPasswordReset(userId: string) {
	const res = await managementFetch(`/users/${encodeURIComponent(userId)}/password/reset-email`, {
		method: "POST",
	});
	if (res.status === 409) {
		throw new Error("Atrium user has no password");
	}
	if (!res.ok) {
		throw new Error(`Atrium password reset failed: ${res.status} ${await res.text()}`);
	}
}

export async function setDirectoryUserPassword(userId: string, password: string) {
	const res = await managementFetch(`/users/${encodeURIComponent(userId)}/password`, {
		method: "POST",
		body: JSON.stringify({ password }),
	});
	if (!res.ok) {
		throw new Error(`Atrium set password failed: ${res.status} ${await res.text()}`);
	}
}

async function tokenRequest(body: URLSearchParams): Promise<IdentityTokenSet> {
	const res = await fetch(`${internalBase()}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) {
		throw new Error(`Atrium token request failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as IdentityTokenSet;
}

export async function exchangeAuthorizationCode(
	code: string,
	redirectUri: string,
	clientId: string,
	clientSecret: string,
): Promise<IdentityTokenSet> {
	return tokenRequest(new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		client_id: clientId,
		client_secret: clientSecret,
	}));
}

export async function refreshDirectoryToken(
	refreshToken: string,
	clientId: string,
	clientSecret: string,
): Promise<IdentityTokenSet> {
	return tokenRequest(new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret,
	}));
}

export async function passwordGrantLogin(
	username: string,
	password: string,
	clientId = config.ATRIUM_E2E_CLIENT_ID || config.ATRIUM_WEB_CLIENT_ID,
	clientSecret?: string,
): Promise<IdentityTokenSet> {
	const body = new URLSearchParams({
		grant_type: "password",
		client_id: clientId,
		username,
		password,
		scope: "openid email profile",
	});
	if (clientSecret) body.set("client_secret", clientSecret);
	return tokenRequest(body);
}
