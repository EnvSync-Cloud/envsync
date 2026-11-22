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
export function isNoResultError(err: unknown): boolean {
	return (
		err instanceof NoResultError ||
		(err instanceof Error && err.constructor.name === "NoResultError")
	);
}

export async function orNotFound<T>(
	promise: Promise<T>,
	resource: string,
	id?: string,
): Promise<T> {
	try {
		return await promise;
	} catch (err) {
		if (isNoResultError(err)) throw new NotFoundError(resource, id);
		throw err;
	}
}
