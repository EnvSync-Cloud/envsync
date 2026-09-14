/**
 * OSS-safe loader. The real implementation lives in envsync-enterprise.
 * Do not `export *` that package — the OSS image does not copy it.
 */
type EnabledProvider = {
	id: string;
	machine_user_id: string | null;
	[key: string]: unknown;
};

type EnterpriseOidcService = {
	OidcService: {
		getAllEnabledProviders: () => Promise<EnabledProvider[]>;
	};
};

export class OidcService {
	public static getAllEnabledProviders = async (): Promise<EnabledProvider[]> => {
		try {
			const { OidcService: EnterpriseOidc } = (await import(
				"../../../envsync-enterprise/src/services/oidc.service.ts"
			)) as EnterpriseOidcService;
			return EnterpriseOidc.getAllEnabledProviders();
		} catch {
			return [];
		}
	};
}
