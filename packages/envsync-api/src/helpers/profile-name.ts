export function splitProfileName(fullName: string | null | undefined): {
	firstName: string;
	lastName: string;
} {
	const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
	const lastName = parts.slice(1).join(" ");
	return {
		firstName: parts[0] ?? "",
		lastName: lastName === "-" ? "" : lastName,
	};
}

export function composeProfileName(input: {
	fullName?: unknown;
	firstName?: unknown;
	lastName?: unknown;
	currentFullName?: string | null;
}): string {
	const firstName = input.firstName;
	const lastName = input.lastName;
	const hasFirst = typeof firstName === "string";
	const hasLast = typeof lastName === "string";
	if (!hasFirst && !hasLast) {
		if (typeof input.fullName === "string") return input.fullName;
		return input.currentFullName ?? "";
	}
	const current = splitProfileName(input.currentFullName);
	const nextFirst = hasFirst ? firstName.trim() : current.firstName;
	const nextLast = hasLast ? lastName.trim() : current.lastName;
	return [nextFirst, nextLast].filter(Boolean).join(" ");
}
