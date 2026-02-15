export const isPasswordStrong = (password: string): boolean => {
	return (
		password.length >= 8 &&
		/[A-Z]/.test(password) &&
		/[a-z]/.test(password) &&
		/[0-9]/.test(password) &&
		/[!@#$%^&*(),.?":{}|<>]/.test(password)
	);
};
