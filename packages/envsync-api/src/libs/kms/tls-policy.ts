export class MinikmsTlsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MinikmsTlsError";
	}
}

export interface MinikmsTlsSettings {
	NODE_ENV?: string;
	MINIKMS_TLS_ENABLED?: string;
	MINIKMS_TLS_INSECURE?: string;
	MINIKMS_TLS_CA_CERT?: string;
	MINIKMS_TLS_CA_CERT_FILE?: string;
	MINIKMS_TLS_CLIENT_CERT?: string;
	MINIKMS_TLS_CLIENT_CERT_FILE?: string;
	MINIKMS_TLS_CLIENT_KEY?: string;
	MINIKMS_TLS_CLIENT_KEY_FILE?: string;
}

export interface MinikmsTlsIssue {
	path: string;
	message: string;
}

function present(value?: string): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

function tlsMaterialIssues(settings: MinikmsTlsSettings): MinikmsTlsIssue[] {
	const issues: MinikmsTlsIssue[] = [];
	if (!present(settings.MINIKMS_TLS_CA_CERT) && !present(settings.MINIKMS_TLS_CA_CERT_FILE)) {
		issues.push({
			path: "MINIKMS_TLS_CA_CERT_FILE",
			message: "miniKMS TLS requires MINIKMS_TLS_CA_CERT or MINIKMS_TLS_CA_CERT_FILE.",
		});
	}
	if (!present(settings.MINIKMS_TLS_CLIENT_CERT) && !present(settings.MINIKMS_TLS_CLIENT_CERT_FILE)) {
		issues.push({
			path: "MINIKMS_TLS_CLIENT_CERT_FILE",
			message: "miniKMS TLS requires MINIKMS_TLS_CLIENT_CERT or MINIKMS_TLS_CLIENT_CERT_FILE.",
		});
	}
	if (!present(settings.MINIKMS_TLS_CLIENT_KEY) && !present(settings.MINIKMS_TLS_CLIENT_KEY_FILE)) {
		issues.push({
			path: "MINIKMS_TLS_CLIENT_KEY_FILE",
			message: "miniKMS TLS requires MINIKMS_TLS_CLIENT_KEY or MINIKMS_TLS_CLIENT_KEY_FILE.",
		});
	}
	return issues;
}

/**
 * Plaintext miniKMS is refused unless NODE_ENV=development and MINIKMS_TLS_INSECURE=true.
 * Any other mode requires MINIKMS_TLS_ENABLED=true plus CA and client certificate material.
 */
export function minikmsTlsIssues(settings: MinikmsTlsSettings): MinikmsTlsIssue[] {
	const development = settings.NODE_ENV === "development";
	const tlsEnabled = settings.MINIKMS_TLS_ENABLED === "true";
	const insecureOptIn = settings.MINIKMS_TLS_INSECURE === "true";
	const issues: MinikmsTlsIssue[] = [];

	if (!development && insecureOptIn) {
		issues.push({
			path: "MINIKMS_TLS_INSECURE",
			message: "MINIKMS_TLS_INSECURE=true is only honored when NODE_ENV=development.",
		});
	}

	if (!tlsEnabled) {
		if (development && insecureOptIn) {
			return issues;
		}
		issues.push({
			path: "MINIKMS_TLS_ENABLED",
			message: development
				? "miniKMS TLS is not configured. Set MINIKMS_TLS_ENABLED=true and provide certificate material, or set MINIKMS_TLS_INSECURE=true for local development only."
				: "Refusing a non-TLS miniKMS connection because NODE_ENV is not development. Set MINIKMS_TLS_ENABLED=true and provide CA and client certificate material.",
		});
		return issues;
	}

	issues.push(...tlsMaterialIssues(settings));
	return issues;
}

export function assertMinikmsTls(settings: MinikmsTlsSettings): "tls" | "insecure" {
	const issues = minikmsTlsIssues(settings);
	if (issues.length > 0) {
		throw new MinikmsTlsError(issues.map(issue => issue.message).join(" "));
	}
	return settings.MINIKMS_TLS_ENABLED === "true" ? "tls" : "insecure";
}
