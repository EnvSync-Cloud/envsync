/**
 * Keycloak bootstrap and token helpers for E2E tests.
 *
 * Uses the Keycloak Admin REST API to create users and the
 * Resource Owner Password Credentials (Direct Access Grants)
 * flow to obtain real JWT access tokens without a browser.
 */

// ── Admin token helpers ─────────────────────────────────────────────

/**
 * Get an admin access token from the master realm.
 */
async function getAdminToken(
	keycloakUrl: string,
	adminUser: string,
	adminPassword: string,
): Promise<string> {
	const base = keycloakUrl.replace(/\/$/, "");
	const res = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "password",
			client_id: "admin-cli",
			username: adminUser,
			password: adminPassword,
		}),
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Keycloak admin token failed: ${res.status} ${text}`);
	}

	const data = (await res.json()) as { access_token: string; expires_in: number };
	return data.access_token;
}

// ── Create test user ────────────────────────────────────────────────

export interface TestUserResult {
	keycloakUserId: string;
	email: string;
	password: string;
}

/**
 * Create a user in Keycloak via the Admin REST API.
 *
 * @param keycloakUrl - Base Keycloak URL (e.g. "http://localhost:8080")
 * @param adminUser - Admin username (e.g. "admin")
 * @param adminPassword - Admin password (e.g. "admin")
 * @param userData - User details to create
 */
export async function createKeycloakTestUser(
	keycloakUrl: string,
	adminUser: string,
	adminPassword: string,
	userData: {
		email: string;
		firstName: string;
		lastName: string;
		password: string;
		realm?: string;
	},
): Promise<TestUserResult> {
	const base = keycloakUrl.replace(/\/$/, "");
	const realm = userData.realm ?? "envsync";
	const token = await getAdminToken(keycloakUrl, adminUser, adminPassword);

	const body = {
		username: userData.email,
		email: userData.email,
		emailVerified: true,
		enabled: true,
		firstName: userData.firstName,
		lastName: userData.lastName,
		credentials: [
			{
				type: "password",
				value: userData.password,
				temporary: false,
			},
		],
	};

	const res = await fetch(`${base}/admin/realms/${realm}/users`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Keycloak create user failed: ${res.status} ${text}`);
	}

	// Keycloak returns 201 with user ID in Location header
	const location = res.headers.get("Location") ?? "";
	const keycloakUserId = location.split("/").pop() ?? "";
	if (!keycloakUserId) {
		throw new Error("Keycloak create user: missing user ID in Location header");
	}

	return {
		keycloakUserId,
		email: userData.email,
		password: userData.password,
	};
}

// ── Get access token via Resource Owner Password Credentials ────────

/**
 * Obtain a real JWT access token for a Keycloak user using
 * the Resource Owner Password Credentials grant (Direct Access Grants).
 *
 * The target client must have "Direct Access Grants" enabled in Keycloak.
 *
 * @param keycloakUrl - Base Keycloak URL (e.g. "http://localhost:8080")
 * @param realm - Keycloak realm (e.g. "envsync")
 * @param clientId - OIDC client ID
 * @param clientSecret - OIDC client secret
 * @param email - User's email/username
 * @param password - User's password
 * @returns The access token string
 */
export async function getKeycloakAccessToken(
	keycloakUrl: string,
	realm: string,
	clientId: string,
	clientSecret: string,
	email: string,
	password: string,
): Promise<string> {
	const base = keycloakUrl.replace(/\/$/, "");

	const res = await fetch(`${base}/realms/${realm}/protocol/openid-connect/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "password",
			client_id: clientId,
			client_secret: clientSecret,
			username: email,
			password,
			scope: "openid profile email",
		}),
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(
			`Keycloak token exchange failed for ${email}: ${res.status} ${text}`,
		);
	}

	const data = (await res.json()) as { access_token: string };
	return data.access_token;
}

/**
 * Delete a test user from Keycloak (cleanup helper).
 */
export async function deleteKeycloakTestUser(
	keycloakUrl: string,
	adminUser: string,
	adminPassword: string,
	userId: string,
	realm?: string,
): Promise<void> {
	const base = keycloakUrl.replace(/\/$/, "");
	const realmName = realm ?? "envsync";
	const token = await getAdminToken(keycloakUrl, adminUser, adminPassword);

	const res = await fetch(`${base}/admin/realms/${realmName}/users/${userId}`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok && res.status !== 404) {
		const text = await res.text();
		throw new Error(`Keycloak delete user failed: ${res.status} ${text}`);
	}
}
