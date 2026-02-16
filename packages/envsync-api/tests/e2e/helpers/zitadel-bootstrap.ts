/**
 * Zitadel bootstrap and token helpers for E2E tests.
 *
 * Uses the Zitadel Management API (admin PAT auth) to create projects,
 * OIDC apps, and users. Uses Session API v2 + OIDC flow to obtain
 * real JWT access tokens without a browser.
 */

import crypto from "node:crypto";

// ── Admin PAT helpers ───────────────────────────────────────────────

function adminHeaders(pat: string): Record<string, string> {
	return {
		Authorization: `Bearer ${pat}`,
		"Content-Type": "application/json",
	};
}

// ── Bootstrap project + OIDC app ────────────────────────────────────

export interface BootstrapResult {
	projectId: string;
	appClientId: string;
	appClientSecret: string;
}

/**
 * Create a Zitadel project and OIDC application configured for
 * authorization code + PKCE with JWT access tokens.
 */
export async function bootstrapZitadelProject(
	url: string,
	pat: string,
): Promise<BootstrapResult> {
	const base = url.replace(/\/$/, "");

	// 1. Create project
	const projectRes = await fetch(`${base}/management/v1/projects`, {
		method: "POST",
		headers: adminHeaders(pat),
		body: JSON.stringify({ name: `e2e-test-${Date.now()}` }),
	});
	if (!projectRes.ok) {
		throw new Error(`Failed to create project: ${projectRes.status} ${await projectRes.text()}`);
	}
	const projectData = (await projectRes.json()) as { id: string };
	const projectId = projectData.id;

	// 2. Create OIDC app with code grant + PKCE + JWT access tokens
	const appRes = await fetch(`${base}/management/v1/projects/${projectId}/apps/oidc`, {
		method: "POST",
		headers: adminHeaders(pat),
		body: JSON.stringify({
			name: "e2e-test-app",
			redirectUris: ["http://localhost:9090/callback"],
			responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
			grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
			appType: "OIDC_APP_TYPE_WEB",
			authMethodType: "OIDC_AUTH_METHOD_TYPE_POST",
			accessTokenType: "OIDC_TOKEN_TYPE_JWT",
			devMode: true,
		}),
	});
	if (!appRes.ok) {
		throw new Error(`Failed to create OIDC app: ${appRes.status} ${await appRes.text()}`);
	}
	const appData = (await appRes.json()) as {
		clientId: string;
		clientSecret: string;
		appId: string;
	};

	return {
		projectId,
		appClientId: appData.clientId,
		appClientSecret: appData.clientSecret,
	};
}

// ── Create test user ────────────────────────────────────────────────

export interface TestUserResult {
	zitadelUserId: string;
	email: string;
	password: string;
}

/**
 * Create a human user in Zitadel via the v2 API.
 */
export async function createZitadelTestUser(
	url: string,
	pat: string,
	opts: { email: string; firstName: string; lastName: string; password: string },
): Promise<TestUserResult> {
	const base = url.replace(/\/$/, "");
	const res = await fetch(`${base}/v2/users/human`, {
		method: "POST",
		headers: adminHeaders(pat),
		body: JSON.stringify({
			username: opts.email,
			profile: {
				givenName: opts.firstName,
				familyName: opts.lastName,
			},
			email: {
				email: opts.email,
				isVerified: true,
			},
			password: {
				password: opts.password,
				changeRequired: false,
			},
		}),
	});
	if (!res.ok) {
		throw new Error(`Failed to create Zitadel test user: ${res.status} ${await res.text()}`);
	}
	const data = (await res.json()) as { userId: string };
	return {
		zitadelUserId: data.userId,
		email: opts.email,
		password: opts.password,
	};
}

// ── Get access token via Session API v2 + OIDC ─────────────────────

/**
 * Obtain a real JWT access token for a Zitadel user using:
 * 1. Session API v2 (create authenticated session)
 * 2. OIDC authorize (initiate flow, finalize with session)
 * 3. Token exchange (authorization code → JWT)
 *
 * No browser required.
 */
export async function getZitadelAccessToken(
	url: string,
	clientId: string,
	clientSecret: string,
	pat: string,
	loginName: string,
	password: string,
): Promise<string> {
	const base = url.replace(/\/$/, "");

	// 1. Create authenticated session
	const sessionRes = await fetch(`${base}/v2/sessions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${pat}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			checks: {
				user: { loginName },
				password: { password },
			},
		}),
	});
	if (!sessionRes.ok) {
		throw new Error(`Session API failed: ${sessionRes.status} ${await sessionRes.text()}`);
	}
	const sessionData = (await sessionRes.json()) as {
		sessionId: string;
		sessionToken: string;
	};

	// 2. Generate PKCE code verifier/challenge
	const codeVerifier = crypto.randomBytes(32).toString("base64url");
	const codeChallenge = crypto
		.createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");

	// 3. Initiate OIDC authorize to get authRequestId
	const authorizeParams = new URLSearchParams({
		client_id: clientId,
		redirect_uri: "http://localhost:9090/callback",
		response_type: "code",
		scope: "openid profile email",
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
	});

	const authorizeRes = await fetch(`${base}/oauth/v2/authorize?${authorizeParams.toString()}`, {
		headers: {
			"x-zitadel-login-client": clientId,
		},
		redirect: "manual",
	});

	// The authorize endpoint redirects to the login UI with an authRequest ID.
	// Different Zitadel setups use different query keys and formats.
	let authRequestId = "";
	const location = authorizeRes.headers.get("location");
	if (location) {
		// Extract authRequest ID from redirect URL.
		// Format: /ui/v2/login/login?authRequest=<id> or similar.
		const locationUrl = new URL(location, base);
		authRequestId =
			locationUrl.searchParams.get("authRequest") ??
			locationUrl.searchParams.get("authRequestID") ??
			locationUrl.searchParams.get("authRequestId") ??
			locationUrl.searchParams.get("id") ??
			"";
		if (!authRequestId) {
			// Fallback: parse raw location string.
			const match = location.match(/authRequest(?:ID|Id)?=([^&]+)/);
			authRequestId = match?.[1] ?? "";
		}
	} else {
		throw new Error(`OIDC authorize did not redirect. Status: ${authorizeRes.status}`);
	}

	if (!authRequestId) {
		throw new Error(`Could not extract authRequestId from redirect: ${location}`);
	}

	// Build candidate IDs. Some versions hand back a numeric ID in authRequestID,
	// while v2 endpoints can expect a V2_ prefixed value.
	const authRequestCandidates = Array.from(
		new Set(
			[authRequestId, decodeURIComponent(authRequestId)]
				.filter(Boolean)
				.flatMap((id) => (id.startsWith("V2_") ? [id] : [id, `V2_${id}`])),
		),
	);

	// Prefer candidates that are visible through the v2 auth_request read endpoint.
	// This avoids finalizing with an already-invalid or wrong-format ID.
	const preflightStatuses: string[] = [];
	const preferredCandidates: string[] = [];
	for (const candidate of authRequestCandidates) {
		const probeRes = await fetch(`${base}/v2/oidc/auth_requests/${encodeURIComponent(candidate)}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${pat}`,
				"x-zitadel-login-client": clientId,
			},
		});
		preflightStatuses.push(`${candidate}:${probeRes.status}`);
		if (probeRes.ok) {
			preferredCandidates.push(candidate);
		}
	}
	const orderedCandidates =
		preferredCandidates.length > 0
			? [...preferredCandidates, ...authRequestCandidates.filter((id) => !preferredCandidates.includes(id))]
			: authRequestCandidates;

	// 4. Finalize auth with session → get callback URL with code
	const finalizeAttempts: Array<{ url: string; body: Record<string, any> }> = [
		...orderedCandidates.map((candidate) => ({
			url: `${base}/v2/oidc/auth_requests/${encodeURIComponent(candidate)}`,
			body: {
				session: {
					sessionId: sessionData.sessionId,
					sessionToken: sessionData.sessionToken,
				},
			},
		})),
		...orderedCandidates.flatMap((candidate) => [
			{
				url: `${base}/oidc/v2/authorize`,
				body: {
					authRequestId: candidate,
					session: {
						sessionId: sessionData.sessionId,
						sessionToken: sessionData.sessionToken,
					},
				},
			},
			{
				url: `${base}/oidc/v2/authorize`,
				body: {
					authRequestID: candidate,
					session: {
						sessionId: sessionData.sessionId,
						sessionToken: sessionData.sessionToken,
					},
				},
			},
		]),
	];

	let finalizeData: { callbackUrl?: string } | null = null;
	const finalizeErrors: string[] = [];
	for (const attempt of finalizeAttempts) {
		const finalizeRes = await fetch(attempt.url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${pat}`,
				"Content-Type": "application/json",
				"x-zitadel-login-client": clientId,
			},
			body: JSON.stringify(attempt.body),
		});
		if (finalizeRes.ok) {
			finalizeData = (await finalizeRes.json()) as { callbackUrl: string };
			break;
		}
		finalizeErrors.push(`${finalizeRes.status} ${await finalizeRes.text()}`);
	}
	if (!finalizeData?.callbackUrl) {
		throw new Error(
			`OIDC finalize failed. location=${location} authRequestCandidates=${orderedCandidates.join(",")} preflight=${preflightStatuses.join(",")} attempts=${finalizeErrors.join(" | ")}`,
		);
	}

	// 5. Extract code from callback URL
	const callbackUrl = new URL(finalizeData.callbackUrl);
	const code = callbackUrl.searchParams.get("code");
	if (!code) {
		throw new Error(`No code in callback URL: ${finalizeData.callbackUrl}`);
	}

	// 6. Exchange code for JWT
	const tokenRes = await fetch(`${base}/oauth/v2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: "http://localhost:9090/callback",
			client_id: clientId,
			client_secret: clientSecret,
			code_verifier: codeVerifier,
		}),
	});
	if (!tokenRes.ok) {
		throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
	}
	const tokenData = (await tokenRes.json()) as { access_token: string };
	return tokenData.access_token;
}
