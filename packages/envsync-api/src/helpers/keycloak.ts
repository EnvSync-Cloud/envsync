import { config } from "@/utils/env";

const base = () => config.KEYCLOAK_URL.replace(/\/$/, "");
const publicBase = () => (config.KEYCLOAK_PUBLIC_URL || config.KEYCLOAK_URL).replace(/\/$/, "");
const realm = () => config.KEYCLOAK_REALM;
const issuer = () => `${publicBase()}/realms/${realm()}`;
const adminRealm = () => "master";
const adminBase = () => `${base()}/admin/realms/${realm()}`;

export const getKeycloakBaseUrl = () => base();
export const getKeycloakPublicBaseUrl = () => publicBase();
export const getKeycloakIssuer = () => issuer();
export const getKeycloakRealm = () => realm();

export interface KeycloakTokenSet {
	id_token?: string;
	access_token: string;
	refresh_token?: string;
	scope?: string;
	expires_in?: number;
	refresh_expires_in?: number;
	token_type?: string;
}

let adminTokenCache: { accessToken: string; expiresAt: number } | null = null;

function isLocalHttpAdminFailure(error: unknown) {
	return error instanceof Error && (
		error.message.includes("HTTPS required") ||
		error.message.includes("invalid_request")
	);
}

function runLocalKeycloakAdmin(args: string[]) {
	const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
	const proc = Bun.spawnSync([
		"docker",
		"compose",
		"exec",
		"-T",
		"keycloak",
		"sh",
		"-lc",
		[
			"/opt/keycloak/bin/kcadm.sh config credentials",
			` --server ${shellQuote(base())}`,
			" --realm master",
			` --user ${shellQuote(config.KEYCLOAK_ADMIN_USER)}`,
			` --password ${shellQuote(config.KEYCLOAK_ADMIN_PASSWORD)}`,
			" >/dev/null && /opt/keycloak/bin/kcadm.sh ",
			args.join(" "),
		].join(""),
	], {
		stdout: "pipe",
		stderr: "pipe",
	});

	if (proc.exitCode !== 0) {
		throw new Error(Buffer.from(proc.stderr).toString() || "Local Keycloak admin command failed");
	}

	return Buffer.from(proc.stdout).toString().trim();
}

async function getAdminAccessToken(): Promise<string> {
	if (adminTokenCache && adminTokenCache.expiresAt > Date.now() + 30_000) {
		return adminTokenCache.accessToken;
	}

	const res = await fetch(`${base()}/realms/${adminRealm()}/protocol/openid-connect/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "password",
			client_id: "admin-cli",
			username: config.KEYCLOAK_ADMIN_USER,
			password: config.KEYCLOAK_ADMIN_PASSWORD,
		}),
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok) {
		throw new Error(`Keycloak admin token request failed: ${res.status} ${await res.text()}`);
	}

	const data = (await res.json()) as { access_token: string; expires_in: number };
	adminTokenCache = {
		accessToken: data.access_token,
		expiresAt: Date.now() + data.expires_in * 1000,
	};

	return data.access_token;
}

async function adminFetch(path: string, options: RequestInit = {}) {
	const token = await getAdminAccessToken();
	return fetch(`${adminBase()}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		},
		signal: options.signal ?? AbortSignal.timeout(10_000),
	});
}

export interface KeycloakUserCreate {
	userName: string;
	email: string;
	firstName: string;
	lastName: string;
	password?: string;
	passwordEnabled?: boolean;
}

export interface KeycloakUserRecord {
	id: string;
	username?: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	enabled?: boolean;
}

function ensureNonEmptyName(value: string, fallback: string): string {
	const s = String(value ?? "").trim();
	return s.length > 0 ? s.slice(0, 255) : fallback;
}

function readIdFromLocationHeader(location: string | null): string | null {
	if (!location) return null;
	const match = location.match(/\/([^/]+)$/);
	return match?.[1] ?? null;
}

export async function getKeycloakUserById(userId: string): Promise<KeycloakUserRecord | null> {
	try {
		const res = await adminFetch(`/users/${encodeURIComponent(userId)}`);
		if (res.status === 404) return null;
		if (!res.ok) {
			throw new Error(`Keycloak get user failed: ${res.status} ${await res.text()}`);
		}
		return (await res.json()) as KeycloakUserRecord;
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;
		try {
			const raw = runLocalKeycloakAdmin([`get users/${JSON.stringify(userId)} -r ${realm()}`]);
			return raw ? (JSON.parse(raw) as KeycloakUserRecord) : null;
		} catch {
			return null;
		}
	}
}

export async function findKeycloakUserByUsername(username: string): Promise<KeycloakUserRecord | null> {
	try {
		const res = await adminFetch(`/users?username=${encodeURIComponent(username)}&exact=true`);
		if (!res.ok) {
			throw new Error(`Keycloak user lookup failed: ${res.status} ${await res.text()}`);
		}
		const users = (await res.json()) as KeycloakUserRecord[];
		return users.find(user => user.username === username) ?? users[0] ?? null;
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;
		const raw = runLocalKeycloakAdmin([
			"get users",
			`-r ${realm()}`,
			`-q username=${JSON.stringify(username)}`,
		]);
		const users = (raw ? JSON.parse(raw) : []) as KeycloakUserRecord[];
		return users.find(user => user.username === username) ?? users[0] ?? null;
	}
}

export async function keycloakUserHasPassword(userId: string): Promise<boolean> {
	try {
		const res = await adminFetch(`/users/${encodeURIComponent(userId)}/credentials`);
		if (!res.ok) return false;
		const credentials = (await res.json()) as Array<{ type?: string }>;
		return credentials.some(credential => credential.type === "password");
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;
		try {
			const raw = runLocalKeycloakAdmin([
				`get users/${JSON.stringify(userId)}/credentials`,
				`-r ${realm()}`,
			]);
			const credentials = (raw ? JSON.parse(raw) : []) as Array<{ type?: string }>;
			return credentials.some(credential => credential.type === "password");
		} catch {
			return false;
		}
	}
}

async function deleteKeycloakPasswordCredentials(userId: string) {
	try {
		const res = await adminFetch(`/users/${encodeURIComponent(userId)}/credentials`);
		if (!res.ok) return;
		const credentials = (await res.json()) as Array<{ id?: string; type?: string }>;
		for (const credential of credentials) {
			if (credential.type !== "password" || !credential.id) continue;
			await adminFetch(
				`/users/${encodeURIComponent(userId)}/credentials/${encodeURIComponent(credential.id)}`,
				{ method: "DELETE" },
			);
		}
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;
		try {
			const raw = runLocalKeycloakAdmin([
				`get users/${JSON.stringify(userId)}/credentials`,
				`-r ${realm()}`,
			]);
			const credentials = (raw ? JSON.parse(raw) : []) as Array<{ id?: string; type?: string }>;
			for (const credential of credentials) {
				if (credential.type !== "password" || !credential.id) continue;
				runLocalKeycloakAdmin([
					`delete users/${JSON.stringify(userId)}/credentials/${JSON.stringify(credential.id)}`,
					`-r ${realm()}`,
				]);
			}
		} catch {
			// Best-effort: JIT users must not keep a usable password.
		}
	}
}

export async function createKeycloakUser(payload: KeycloakUserCreate) {
	const passwordEnabled = payload.passwordEnabled !== false && Boolean(payload.password);

	try {
		const body: Record<string, unknown> = {
			username: payload.userName,
			email: payload.email,
			emailVerified: true,
			enabled: true,
			firstName: ensureNonEmptyName(payload.firstName, "User"),
			lastName: ensureNonEmptyName(payload.lastName, "-"),
		};
		if (passwordEnabled && payload.password) {
			body.credentials = [
				{
					type: "password",
					value: payload.password,
					temporary: false,
				},
			];
		}

		const res = await adminFetch("/users", {
			method: "POST",
			body: JSON.stringify(body),
		});

		if (!res.ok && res.status !== 201) {
			throw new Error(`Keycloak create user failed: ${res.status} ${await res.text()}`);
		}

		const createdId = readIdFromLocationHeader(res.headers.get("location"));
		let userId = createdId;
		if (!userId) {
			const lookup = await adminFetch(`/users?username=${encodeURIComponent(payload.userName)}&exact=true`);
			if (!lookup.ok) {
				throw new Error(`Keycloak user lookup failed after create: ${lookup.status} ${await lookup.text()}`);
			}
			const users = (await lookup.json()) as Array<{ id: string }>;
			userId = users[0]?.id ?? null;
		}
		if (!userId) throw new Error("Keycloak create user succeeded but no user id could be resolved");
		if (!passwordEnabled) {
			await deleteKeycloakPasswordCredentials(userId);
		}
		return { id: userId };
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;

		runLocalKeycloakAdmin([
			"create users",
			`-r ${realm()}`,
			`-s username=${JSON.stringify(payload.userName)}`,
			`-s email=${JSON.stringify(payload.email)}`,
			"-s enabled=true",
			"-s emailVerified=true",
			`-s firstName=${JSON.stringify(ensureNonEmptyName(payload.firstName, "User"))}`,
			`-s lastName=${JSON.stringify(ensureNonEmptyName(payload.lastName, "-"))}`,
		]);

		const userJson = runLocalKeycloakAdmin([
			"get users",
			`-r ${realm()}`,
			`-q username=${JSON.stringify(payload.userName)}`,
		]);
		const users = JSON.parse(userJson) as Array<{ id: string; username?: string }>;
		const user = users.find(candidate => candidate.username === payload.userName) ?? users[0];
		if (!user?.id) throw new Error("Local Keycloak fallback created user but no user id could be resolved");

		if (passwordEnabled && payload.password) {
			runLocalKeycloakAdmin([
				"set-password",
				`-r ${realm()}`,
				`--userid ${JSON.stringify(user.id)}`,
				`--new-password ${JSON.stringify(payload.password)}`,
			]);
		} else {
			await deleteKeycloakPasswordCredentials(user.id);
		}

		return { id: user.id };
	}
}

export async function updateKeycloakUser(
	userId: string,
	payload: { firstName?: string; lastName?: string; email?: string },
) {
	try {
		const currentRes = await adminFetch(`/users/${userId}`);
		if (!currentRes.ok) {
			throw new Error(`Keycloak read user failed: ${currentRes.status} ${await currentRes.text()}`);
		}
		const current = (await currentRes.json()) as {
			username?: string;
			firstName?: string;
			lastName?: string;
			email?: string;
			enabled?: boolean;
		};

		const res = await adminFetch(`/users/${userId}`, {
			method: "PUT",
			body: JSON.stringify({
				username: current.username,
				enabled: current.enabled ?? true,
				emailVerified: true,
				email: payload.email ?? current.email,
				firstName: ensureNonEmptyName(payload.firstName ?? current.firstName ?? "", "User"),
				lastName: ensureNonEmptyName(payload.lastName ?? current.lastName ?? "", "-"),
			}),
		});

		if (!res.ok && res.status !== 204) {
			throw new Error(`Keycloak update user failed: ${res.status} ${await res.text()}`);
		}
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;
		runLocalKeycloakAdmin([
			`update users/${JSON.stringify(userId)} -r ${realm()}`,
			payload.email ? `-s email=${JSON.stringify(payload.email)}` : "",
			payload.firstName ? `-s firstName=${JSON.stringify(ensureNonEmptyName(payload.firstName, "User"))}` : "",
			payload.lastName ? `-s lastName=${JSON.stringify(ensureNonEmptyName(payload.lastName, "-"))}` : "",
			"-s emailVerified=true",
			"-s enabled=true",
		].filter(Boolean));
	}
}

export async function deleteKeycloakUser(userId: string) {
	try {
		const res = await adminFetch(`/users/${userId}`, { method: "DELETE" });
		if (!res.ok && res.status !== 204 && res.status !== 404) {
			throw new Error(`Keycloak delete user failed: ${res.status} ${await res.text()}`);
		}
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;
		runLocalKeycloakAdmin([`delete users/${JSON.stringify(userId)} -r ${realm()}`]);
	}
}

export async function sendKeycloakPasswordReset(userId: string) {
	try {
		const res = await adminFetch(`/users/${userId}/execute-actions-email`, {
			method: "PUT",
			body: JSON.stringify(["UPDATE_PASSWORD"]),
		});
		if (!res.ok && res.status !== 204) {
			throw new Error(`Keycloak password reset failed: ${res.status} ${await res.text()}`);
		}
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;
		runLocalKeycloakAdmin([
			`update users/${JSON.stringify(userId)} -r ${realm()}`,
			"-s requiredActions=[\"UPDATE_PASSWORD\"]",
		]);
	}
}

export async function setKeycloakUserPassword(userId: string, password: string) {
	try {
		const res = await adminFetch(`/users/${encodeURIComponent(userId)}/reset-password`, {
			method: "PUT",
			body: JSON.stringify({
				type: "password",
				value: password,
				temporary: false,
			}),
		});
		if (!res.ok && res.status !== 204) {
			throw new Error(`Keycloak set password failed: ${res.status} ${await res.text()}`);
		}
	} catch (error) {
		if (!isLocalHttpAdminFailure(error)) throw error;
		runLocalKeycloakAdmin([
			"set-password",
			`-r ${realm()}`,
			`--userid ${JSON.stringify(userId)}`,
			`--new-password ${JSON.stringify(password)}`,
		]);
	}
}

export async function keycloakTokenExchange(
	code: string,
	redirectUri: string,
	clientId: string,
	clientSecret: string,
): Promise<KeycloakTokenSet> {
	const res = await fetch(`${base()}/realms/${realm()}/protocol/openid-connect/token`, {
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
	});

	if (!res.ok) {
		throw new Error(`Keycloak token exchange failed: ${res.status} ${await res.text()}`);
	}

	return (await res.json()) as KeycloakTokenSet;
}

export async function keycloakRefreshToken(
	refreshToken: string,
	clientId: string,
	clientSecret: string,
): Promise<KeycloakTokenSet> {
	const res = await fetch(`${base()}/realms/${realm()}/protocol/openid-connect/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: clientId,
			client_secret: clientSecret,
		}),
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok) {
		throw new Error(`Keycloak refresh failed: ${res.status} ${await res.text()}`);
	}

	return (await res.json()) as KeycloakTokenSet;
}

export async function keycloakPasswordLogin(
	username: string,
	password: string,
	clientId = config.KEYCLOAK_WEB_CLIENT_ID,
	clientSecret?: string,
): Promise<KeycloakTokenSet> {
	const body = new URLSearchParams({
		grant_type: "password",
		client_id: clientId,
		username,
		password,
		scope: "openid email profile",
	});
	if (clientSecret) {
		body.set("client_secret", clientSecret);
	}

	const res = await fetch(`${base()}/realms/${realm()}/protocol/openid-connect/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok) {
		throw new Error(`Keycloak password login failed: ${res.status} ${await res.text()}`);
	}

	return (await res.json()) as KeycloakTokenSet;
}
