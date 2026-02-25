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
	constructor(resource: string, id?: string) {
		super(
			id ? `${resource} not found: ${id}` : `${resource} not found`,
			404,
			"NOT_FOUND",
		);
	}
}

export class ConflictError extends AppError {
	constructor(msg: string) {
		super(msg, 409, "CONFLICT");
	}
}

export class ValidationError extends AppError {
	constructor(msg: string) {
		super(msg, 422, "VALIDATION_ERROR");
	}
}

export class BusinessRuleError extends AppError {
	constructor(msg: string, status = 422) {
		super(msg, status, "BUSINESS_RULE_VIOLATION");
	}
}

