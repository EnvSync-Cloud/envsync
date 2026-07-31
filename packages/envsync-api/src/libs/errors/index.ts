import { NoResultError } from "kysely";

import { NotFoundError } from "envsync-kernel/errors";

export {
	AppError,
	BusinessRuleError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "envsync-kernel/errors";

/**
 * Wraps executeTakeFirstOrThrow, converting NoResultError → NotFoundError
 */
export async function orNotFound<T>(
	promise: Promise<T>,
	resource: string,
	id?: string,
): Promise<T> {
	try {
		return await promise;
	} catch (err) {
		if (err instanceof NoResultError) throw new NotFoundError(resource, id);
		throw err;
	}
}
