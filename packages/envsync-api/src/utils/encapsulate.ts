export const encapsulate = (secret: string) => {
	// replace all characters with asterisks except last 5 characters
	return secret.slice(0, -5).replace(/./g, "*") + secret.slice(-5);
};
