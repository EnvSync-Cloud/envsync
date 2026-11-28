import { useProofReplayForTests } from "@/helpers/dpop";
import { AppError } from "@/libs/errors";

const seen = new Set<string>();

useProofReplayForTests({
	async claim(jti: string) {
		if (seen.has(jti)) {
			throw new AppError("DPoP proof was already used", 401, "DPOP_REPLAYED");
		}
		seen.add(jti);
	},
});
