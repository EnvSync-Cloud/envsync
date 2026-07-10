import { EditionPolicyService } from "@/services/edition-policy.service";
import { ForbiddenError } from "@/libs/errors";

export function assertEnterprise() {
	if (!EditionPolicyService.isEnterprise()) {
		throw new ForbiddenError(
			"This feature requires an enterprise license.",
			"ENTERPRISE_FEATURE_REQUIRED",
		);
	}
}
