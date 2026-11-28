/** Stable x.y.z or prerelease x.y.z-rc.N. The rc counter has no leading zeros. */
export const DEPLOY_RELEASE_VERSION_RE = /^\d+\.\d+\.\d+(?:-rc\.[1-9]\d*)?$/;

export function assertDeployReleaseVersion(version: string, label = "release version"): void {
	if (!DEPLOY_RELEASE_VERSION_RE.test(version)) {
		throw new Error(
			`Invalid ${label} '${version}'. Expected x.y.z or x.y.z-rc.N, such as 0.6.2 or 0.6.2-rc.1.`,
		);
	}
}
