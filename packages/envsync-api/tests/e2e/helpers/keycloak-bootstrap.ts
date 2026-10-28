/**
 * Keycloak bootstrap and token helpers for E2E tests.
 */

async function getAdminToken(url: string, username: string, password: string): Promise<string> {
	const base = url.replace(/\/$/, "");
	const clientId = process.env.ATRIUM_MANAGEMENT_CLIENT_ID || username || "management";
	const clientSecret = process.env.ATRIUM_MANAGEMENT_CLIENT_SECRET || password || "replace-me-management";
	const res = await fetch(`${base}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: clientId,
			client_secret: clientSecret,
			scope: "management",
		}),
	});
	if (!res.ok) {
		throw new Error(`Failed to get Atrium management token: ${res.status} ${await res.text()}`);
	}
	const data = (await res.json()) as { access_token: string };
	return data.access_token;
}

function adminHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};
}

export interface BootstrapResult {
	clientId: string;
	clientSecret: string;
}

export async function bootstrapKeycloakClient(
	url: string,
	realm: string,
	adminUser: string,
	adminPassword: string,
): Promise<BootstrapResult> {
	const base = url.replace(/\/$/, "");
	const token = await getAdminToken(base, adminUser, adminPassword);
	const clientId = process.env.ATRIUM_E2E_CLIENT_ID ?? "envsync-e2e";
	void realm;

	const lookup = await fetch(`${base}/api/clients/${encodeURIComponent(clientId)}`, {
		headers: adminHeaders(token),
	});
	if (!lookup.ok) {
		throw new Error(`Failed to look up Atrium E2E client: ${lookup.status} ${await lookup.text()}`);
	}
	const client = (await lookup.json()) as { id?: string; secret?: string };
	if (!client.id || !client.secret) {
		throw new Error("Atrium E2E client is missing an id or secret. atrium-seed did not restore clients.");
	}
	return { clientId: client.id, clientSecret: client.secret };
}

export interface TestUserResult {
	keycloakUserId: string;
	email: string;
	password: string;
}

export async function createKeycloakTestUser(
	url: string,
	realm: string,
	adminUser: string,
	adminPassword: string,
	opts: { email: string; firstName: string; lastName: string; password: string },
): Promise<TestUserResult> {
	const base = url.replace(/\/$/, "");
	void realm;
	const token = await getAdminToken(base, adminUser, adminPassword);
	const res = await fetch(`${base}/api/users`, {
		method: "POST",
		headers: adminHeaders(token),
		body: JSON.stringify({
			username: opts.email,
			email: opts.email,
			email_verified: true,
			given_name: opts.firstName,
			family_name: opts.lastName,
			password: opts.password,
		}),
	});
	if (!res.ok && res.status !== 201) {
		throw new Error(`Failed to create Atrium test user: ${res.status} ${await res.text()}`);
	}
	const user = (await res.json()) as { id?: string };
	if (!user?.id) throw new Error("Created Atrium test user but could not resolve id");
	return {
		keycloakUserId: user.id,
		email: opts.email,
		password: opts.password,
	};
}

export async function getKeycloakAccessToken(
	url: string,
	realm: string,
	clientId: string,
	clientSecret: string,
	loginName: string,
	password: string,
): Promise<string> {
	const base = url.replace(/\/$/, "");
	void realm;
	const res = await fetch(`${base}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "password",
			client_id: clientId,
			client_secret: clientSecret,
			username: loginName,
			password,
			scope: "openid profile email",
		}),
	});
	if (!res.ok) {
		throw new Error(`Failed to get Keycloak access token: ${res.status} ${await res.text()}`);
	}
	const data = (await res.json()) as { access_token: string };
	return data.access_token;
}
