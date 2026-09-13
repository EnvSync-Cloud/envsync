export const slugifyName = (name: string): string => {
	const randomSuffix = crypto.randomInt(100000, 1000000).toString();

	return name
		.toLowerCase()
		.replace(/\s+/g, "-") // replace spaces with hyphens
		.replace(/[^a-z0-9-]/g, "") // remove special characters except hyphens
		.concat(`-${randomSuffix}`); // add random suffix
};
