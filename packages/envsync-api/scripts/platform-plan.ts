/**
 * Hosted platform-admin helper. Run on a laptop on the admin VPN.
 *
 *   export ENVSYNC_API_URL=https://api.envsync.cloud
 *   export ENVSYNC_PLATFORM_ADMIN_TOKEN=...
 *   bun run packages/envsync-api/scripts/platform-plan.ts get --org-id <uuid>
 *   bun run packages/envsync-api/scripts/platform-plan.ts set --org-id <uuid> --plan plus
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
const source = flag(args, "source") ?? "support";

if (cmd === "get") {
	if (!orgId) throw new Error("--org-id is required");
	await request(orgId);
} else if (cmd === "set") {
	if (!orgId || !plan) throw new Error("--org-id and --plan are required");
	await request(orgId, {
		method: "PUT",
		body: JSON.stringify({ plan, source }),
	});
} else {
	console.log("Usage: platform-plan.ts <get|set> --org-id <uuid> [--plan developer|plus|enterprise]");
	process.exit(cmd ? 1 : 0);
}
