/**
 * Hosted platform-admin helper. Run on a laptop on the admin VPN.
 *
 *   export ENVSYNC_API_URL=https://api.envsync.cloud
 *   export ENVSYNC_PLATFORM_ADMIN_TOKEN=...
 *   bun run packages/envsync-api/scripts/platform-plan.ts get --org-id <uuid>
 *   bun run packages/envsync-api/scripts/platform-plan.ts set --org-id <uuid> --plan plus
 *   bun run packages/envsync-api/scripts/platform-plan.ts set --org-id <uuid> --overlay change_requests,saml
 */

const apiUrl = (process.env.ENVSYNC_API_URL ?? "").replace(/\/$/, "");
const token = process.env.ENVSYNC_PLATFORM_ADMIN_TOKEN ?? "";

function flag(args: string[], name: string) {
	const prefix = `--${name}=`;
	const inline = args.find(arg => arg.startsWith(prefix));
	if (inline) return inline.slice(prefix.length);
	const index = args.indexOf(`--${name}`);
	if (index === -1) return undefined;
	const next = args[index + 1];
	return next && !next.startsWith("--") ? next : "";
}

async function request(path: string, init?: RequestInit) {
	if (!apiUrl || !token) {
		throw new Error("ENVSYNC_API_URL and ENVSYNC_PLATFORM_ADMIN_TOKEN are required");
	}
	const res = await fetch(`${apiUrl}/api/v1/manage/org-features/${path}`, {
		...init,
		headers: {
			"content-type": "application/json",
			"X-EnvSync-Platform-Token": token,
			...(init?.headers ?? {}),
		},
	});
	const body = await res.text();
	if (!res.ok) {
		throw new Error(`${res.status} ${body}`);
	}
	console.log(body);
}

const [cmd, ...args] = process.argv.slice(2);
const orgId = flag(args, "org-id");
const plan = flag(args, "plan");
const overlay = flag(args, "overlay");
const source = flag(args, "source") ?? "support";

if (cmd === "get") {
	if (!orgId) throw new Error("--org-id is required");
	await request(orgId);
} else if (cmd === "set") {
	if (!orgId) throw new Error("--org-id is required");
	if (!plan && overlay === undefined) {
		throw new Error("--plan and/or --overlay is required");
	}
	const body: Record<string, unknown> = { source };
	if (plan) body.plan = plan;
	if (overlay !== undefined) {
		body.overlay_features = overlay
			.split(",")
			.map(value => value.trim())
			.filter(Boolean);
	}
	await request(orgId, {
		method: "PUT",
		body: JSON.stringify(body),
	});
} else {
	console.log(
		"Usage: platform-plan.ts <get|set> --org-id <uuid> [--plan developer|plus|enterprise] [--overlay change_requests,saml]",
	);
	process.exit(cmd ? 1 : 0);
}
