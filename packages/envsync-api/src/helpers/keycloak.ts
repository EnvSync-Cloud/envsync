import { config } from "@/utils/env";

const base = () => config.KEYCLOAK_URL.replace(/\/$/, "");
const realm = () => config.KEYCLOAK_REALM;
const issuer = () => `${base()}/realms/${realm()}`;
const adminBase = () => `${base()}/admin/realms/${realm()}`;

export const getKeycloakIssuer = () => issuer();

// ─── Admin token management ────────────────────────────────────────────────

let cachedAdminToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Get an admin access token via the admin-cli client.
 * Cached and auto-refreshed when expired.
 */
export async function getAdminToken(): Promise<string> {
	if (cachedAdminToken && Date.now() < tokenExpiresAt - 30_000) {
		return cachedAdminToken;
	}

	const res = await fetch(
		`${base()}/realms/master/protocol/openid-connect/token`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "password",
				client_id: "admin-cli",
				username: config.KEYCLOAK_ADMIN_USER,
				password: config.KEYCLOAK_ADMIN_PASSWORD,
			}),
			signal: AbortSignal.timeout(10_000),
		},
	);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Keycloak admin token failed: ${res.status} ${text}`);
	}

	const data = (await res.json()) as {
		access_token: string;
		expires_in: number;
	};
	cachedAdminToken = data.access_token;
	tokenExpiresAt = Date.now() + data.expires_in * 1000;
	return cachedAdminToken;
}

async function adminFetch(path: string, options: RequestInit = {}) {
	const token = await getAdminToken();
	const url = `${adminBase()}${path}`;
	return fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		},
		signal: options.signal ?? AbortSignal.timeout(10_000),
	});
}

// ─── User management ───────────────────────────────────────────────────────

export interface KeycloakUserCreate {
	email: string;
	firstName: string;
	lastName: string;
	password: string;
}

export async function createKeycloakUser(
	payload: KeycloakUserCreate,
): Promise<{ id: string }> {
	const body = {
		username: payload.email,
		email: payload.email,
		emailVerified: true,
		enabled: true,
		firstName: payload.firstName || "User",
		lastName: payload.lastName || "-",
		credentials: [
			{
				type: "password",
				value: payload.password,
				temporary: false,
			},
		],
	};

	const res = await adminFetch("/users", {
		method: "POST",
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Keycloak create user failed: ${res.status} ${text}`);
	}

	// Keycloak returns 201 with user ID in Location header
	const location = res.headers.get("Location") ?? "";
	const id = location.split("/").pop() ?? "";
	if (!id) {
		throw new Error("Keycloak create user: missing user ID in Location header");
	}
	return { id };
}

export async function updateKeycloakUser(
	userId: string,
	payload: { firstName?: string; lastName?: string; email?: string },
) {
	const body: Record<string, unknown> = {};
	if (payload.firstName != null) body.firstName = payload.firstName;
	if (payload.lastName != null) body.lastName = payload.lastName;
	if (payload.email != null) {
		body.email = payload.email;
		body.emailVerified = true;
	}
	if (Object.keys(body).length === 0) return;

	const res = await adminFetch(`/users/${userId}`, {
		method: "PUT",
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Keycloak update user failed: ${res.status} ${text}`);
	}
}

export async function deleteKeycloakUser(userId: string) {
	const res = await adminFetch(`/users/${userId}`, { method: "DELETE" });
	if (!res.ok && res.status !== 404) {
		const text = await res.text();
		throw new Error(`Keycloak delete user failed: ${res.status} ${text}`);
	}
}

export async function sendKeycloakPasswordReset(userId: string) {
	const res = await adminFetch(`/users/${userId}/execute-actions-email`, {
		method: "PUT",
		body: JSON.stringify(["UPDATE_PASSWORD"]),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Keycloak password reset failed: ${res.status} ${text}`);
	}
}

// ─── Token exchange ────────────────────────────────────────────────────────

export async function keycloakTokenExchange(
	code: string,
	redirectUri: string,
	clientId: string,
	clientSecret: string,
): Promise<{ id_token?: string; access_token: string }> {
	const res = await fetch(
		`${issuer()}/protocol/openid-connect/token`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: redirectUri,
				client_id: clientId,
				client_secret: clientSecret,
			}),
			signal: AbortSignal.timeout(10_000),
		},
	);
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Keycloak token exchange failed: ${res.status} ${text}`);
	}
	return (await res.json()) as { id_token?: string; access_token: string };
}
