import { EnvSyncAPISDK } from "@envsync-cloud/envsync-ts-sdk";
import { env, type Function } from "@/utils/env";

/**
 *
 * Creates an instance of the EnvSync API SDK with the provided access token.
 * @param accessToken - Optional access token to use for API requests. If not provided, it will attempt to retrieve it from localStorage.
 * @returns An instance of the EnvSyncAPISDK configured with the base URL and token.
 */
export const getSDK = (accessToken?: string) => {
  const getAccessToken = async () => {
    try {
      const token = accessToken || localStorage.getItem("access_token");
      if (token.length === 0) {
        throw new Error("Access token is empty");
      }

      return token;
    } catch (error) {
      console.warn("Failed to retrieve access token from localStorage:", error);
      return "";
    }
  };

  return new EnvSyncAPISDK({
    BASE: env.VITE_API_BASE_URL,
    TOKEN: getAccessToken,
  });
};

export const sdk = getSDK();

export interface MutationOptions<TData = unknown, TVariables = unknown> {
  before?: Function<TVariables>;
  onSuccess?: Function<{ data: TData; variables?: TVariables }>;
  onError?: Function<{ error: Error; variables?: TVariables }>;
}
