/** Public port: miniKMS client + tenant wrapping hook for EE CMK. */
export {
	KMSClient,
	KMS_CONFIG_SCOPE_ID,
} from "@/libs/kms/client";
export type {
	TenantWrappingProvider,
	RewrapTarget,
	EncryptResult,
	DecryptResult,
	KeyInfoResult,
	CreateDataKeyResult,
	RotateDataKeyResult,
	ReEncryptResult,
} from "@/libs/kms/client";
