import { env } from "@/utils/env";
import { EnvSyncAPISDK } from "@envsync-cloud/envsync-ts-sdk"

export const api = new EnvSyncAPISDK({
    BASE: env.VITE_API_BASE_URL,
});