const CORE_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const RELEASE_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.([1-9]\d*))?$/;
const RC_PATTERN = /^[1-9]\d*$/;

function blank(value: string | null | undefined): boolean {
	return value === undefined || value === null || value.trim().length === 0;
}

function stripTagPrefix(value: string): string {
	return value.trim().replace(/^v/, "");
}

function reject(message: string): never {
	throw new Error(message);
}

/**
 * Empty version and empty rc means the caller should cut the next rc.
 * A version of x.y.z with an rc number becomes x.y.z-rc.N.
 * An rc number alone uses the core of the current package version.
 */
export function resolveManualReleaseVersion(input: {
	current: string;
	version?: string | null;
	rc?: string | null;
}): string | null {
	const versionText = blank(input.version) ? "" : stripTagPrefix(input.version ?? "");
	const rcText = blank(input.rc) ? "" : (input.rc ?? "").trim();
	if (versionText.length === 0 && rcText.length === 0) return null;
	if (rcText.length > 0 && !RC_PATTERN.test(rcText)) {
		reject(`Invalid rc: ${rcText}. Expected a positive integer with no leading zeros, such as 1.`);
	}

	if (versionText.length === 0) {
		const current = RELEASE_PATTERN.exec(stripTagPrefix(input.current));
		if (!current) {
			reject(
				`Cannot apply rc ${rcText} to current version ${input.current}. Expected x.y.z or x.y.z-rc.N.`,
			);
		}
		return `${current[1]}.${current[2]}.${current[3]}-rc.${rcText}`;
	}

	const full = RELEASE_PATTERN.exec(versionText);
	if (!full) {
		reject(`Invalid version: ${versionText}. Expected x.y.z or x.y.z-rc.N.`);
	}
	const core = `${full[1]}.${full[2]}.${full[3]}`;
	if (!CORE_PATTERN.test(core)) {
		reject(`Invalid version: ${versionText}. Expected x.y.z or x.y.z-rc.N.`);
	}
	if (full[4] && rcText.length > 0) {
		reject(`Version ${versionText} already includes an rc. Leave the rc input empty, or pass the core version and an rc number.`);
	}
	if (full[4]) return `${core}-rc.${full[4]}`;
	if (rcText.length > 0) return `${core}-rc.${rcText}`;
	return core;
}
