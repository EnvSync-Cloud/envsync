/**
 * OSS-safe loader. The real implementation lives in envsync-enterprise.
 * Do not `export *` that package — the OSS image does not copy it.
 */
type EnabledProvider = {
	id: string;
	org_id: string;
	provider_type: string;
	issuer_url: string;
	audience: string;
	enabled: boolean;
	allowed_subjects: unknown;
	machine_user_id: string | null;
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
