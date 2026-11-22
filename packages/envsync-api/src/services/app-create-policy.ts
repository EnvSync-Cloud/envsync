/** BYOK is only the caller-supplied key. Managed keys and secret-less projects are not. */
export function appCreateNeedsByokPlan(enableSecrets: boolean, isManagedSecret: boolean) {
	return enableSecrets && !isManagedSecret;
}
