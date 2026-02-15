import { ApiKeyService } from "@/services/api_key.service";
import { UserService } from "@/services/user.service";
import { verifyJWTToken } from "./jwt";

export const validateAccess = async ({
	token,
	type,
}: {
	token: string;
	type: "JWT" | "API_KEY";
}): Promise<{
	user_id: string;
}> => {
	try {
		let userId: string = "";

		if (type === "JWT") {
			const decoded = await verifyJWTToken(token);
			const idpSub = decoded.sub as string;

			const user = await UserService.getUserByIdpId(idpSub);
			userId = user.id;
		} else if (type === "API_KEY") {
			const apiKey = await ApiKeyService.getKeyByCreds(token);

			if (!apiKey) {
				throw new Error("Invalid API key");
			}

			// registerKeyUsage
			await ApiKeyService.registerKeyUsage(apiKey.id);

			userId = apiKey.user_id;
		}

		return {
			user_id: userId,
		};
	} catch (error) {
		throw new Error(
			"Unauthorized access: " + (error instanceof Error ? error.message : "Unknown error"),
		);
	}
};
