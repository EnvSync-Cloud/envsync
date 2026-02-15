export const slugifyName = (name: string): string => {
	// convert to lowercase
	// replace spaces with hyphens
	// remove special characters except hyphens
	// add a random suffix to ensure uniqueness with 6 digit random number
	const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();

	return name
		.toLowerCase()
		.replace(/\s+/g, "-") // replace spaces with hyphens
		.replace(/[^a-z0-9-]/g, "") // remove special characters except hyphens
		.concat(`-${randomSuffix}`); // add random suffix
};
