export class STDBConnectionError extends Error {
	constructor(message: string) {
		super(`STDB connection error: ${message}`);
		this.name = "STDBConnectionError";
	}
}

export class STDBReducerError extends Error {
	public readonly reducer: string;
	public readonly stdbMessage: string;

	constructor(reducer: string, message: string) {
		super(`STDB reducer '${reducer}' failed: ${message}`);
		this.name = "STDBReducerError";
		this.reducer = reducer;
		this.stdbMessage = message;
	}
}

export class STDBTimeoutError extends Error {
	constructor(operation: string, timeoutMs: number) {
		super(`STDB operation '${operation}' timed out after ${timeoutMs}ms`);
		this.name = "STDBTimeoutError";
	}
}
