import { NoResultError } from "kysely";

export class AppError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number,
		public readonly code: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string, id?: string, code = "NOT_FOUND") {
		super(
			id ? `${resource} not found: ${id}` : `${resource} not found`,
			404,
			code,
		);
	}
}

export class ConflictError extends AppError {
	constructor(msg: string, code = "CONFLICT") {
		super(msg, 409, code);
	}
}

export class ValidationError extends AppError {
	constructor(msg: string, code = "VALIDATION_ERROR") {
		super(msg, 422, code);
	}
}

export class BusinessRuleError extends AppError {
	constructor(msg: string, status = 422, code = "BUSINESS_RULE_VIOLATION") {
		super(msg, status, code);
	}
}

export class ForbiddenError extends AppError {
	constructor(msg: string, code = "FORBIDDEN") {
		super(msg, 403, code);
	}
}

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
