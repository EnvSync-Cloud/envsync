/** Expand configured site URLs into exact browser Origin values (no path, no trailing slash). */
export function expandBrowserOrigins(...urls: Array<string | undefined | null>): string[] {
	const origins = new Set<string>();
	for (const raw of urls) {
		if (!raw) continue;
		try {
			const url = new URL(raw);
			origins.add(url.origin);
			const host = url.hostname;
			if (host.startsWith("www.")) {
				origins.add(`${url.protocol}//${host.slice(4)}`);
			} else if (host.includes(".") && !host.endsWith(".localhost") && host !== "localhost") {
				origins.add(`${url.protocol}//www.${host}`);
			}
		} catch {
			// Ignore unparseable values.
		}
	}
	return [...origins];
}

export function isAllowedBrowserOrigin(origin: string | undefined | null, allowed: readonly string[]): boolean {
	if (!origin) return false;
	return allowed.includes(origin);
}
