/**
 * Public first-party paths → PostHog upstream paths.
 * Browser blockers match /flags/, /e/, /batch, /decide, /static/array.js.
 */
export const POSTHOG_PUBLIC_TO_UPSTREAM: Array<{ publicPrefix: string; upstreamPrefix: string }> = [
	{ publicPrefix: "/cfg/", upstreamPrefix: "/flags/" },
	{ publicPrefix: "/cfg", upstreamPrefix: "/flags" },
	{ publicPrefix: "/ev/", upstreamPrefix: "/e/" },
	{ publicPrefix: "/ev", upstreamPrefix: "/e" },
	{ publicPrefix: "/q", upstreamPrefix: "/batch" },
	{ publicPrefix: "/a/", upstreamPrefix: "/static/" },
	{ publicPrefix: "/r/", upstreamPrefix: "/s/" },
	{ publicPrefix: "/d", upstreamPrefix: "/decide" },
];

export function rewritePosthogPublicPathname(pathname: string): string {
	const rules: Array<[string, string]> = [
		["/ph/flags", "/ph/cfg"],
		["/ph/e/", "/ph/ev/"],
		["/ph/e", "/ph/ev"],
		["/ph/batch", "/ph/q"],
		["/ph/static/", "/ph/a/"],
		["/ph/s/", "/ph/r/"],
		["/ph/decide", "/ph/d"],
	];
	for (const [from, to] of rules) {
		if (pathname === from || pathname.startsWith(`${from}/`) || (from.endsWith("/") && pathname.startsWith(from))) {
			return to + pathname.slice(from.length);
		}
	}
	return pathname;
}

export function rewritePosthogRequestUrl(url: URL): URL {
	const next = new URL(url.toString());
	next.pathname = rewritePosthogPublicPathname(next.pathname);
	return next;
}

export function mapPublicPosthogPathToUpstream(path: string): string {
	const normalized = path.startsWith("/") ? path : `/${path}`;
	for (const { publicPrefix, upstreamPrefix } of POSTHOG_PUBLIC_TO_UPSTREAM) {
		if (
			normalized === publicPrefix ||
			normalized.startsWith(`${publicPrefix}/`) ||
			(publicPrefix.endsWith("/") && normalized.startsWith(publicPrefix))
		) {
			return upstreamPrefix + normalized.slice(publicPrefix.length);
		}
	}
	return normalized;
}
