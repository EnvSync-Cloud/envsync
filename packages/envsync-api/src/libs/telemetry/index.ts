import { trace, SpanStatusCode, type Span, type SpanKind, type Attributes } from "@opentelemetry/api";

const TRACER_NAME = "envsync-api";

export function getTracer() {
	return trace.getTracer(TRACER_NAME);
}

export function getActiveSpan(): Span | undefined {
	return trace.getActiveSpan();
}

export async function withSpan<T>(
	name: string,
	attributes: Attributes,
	fn: (span: Span) => Promise<T>,
	kind?: SpanKind,
): Promise<T> {
	const tracer = getTracer();
	return tracer.startActiveSpan(name, { attributes, kind }, async (span) => {
		try {
			const result = await fn(span);
			span.setStatus({ code: SpanStatusCode.OK });
			return result;
		} catch (error) {
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: error instanceof Error ? error.message : String(error),
			});
			if (error instanceof Error) {
				span.recordException(error);
			}
			throw error;
		} finally {
			span.end();
		}
	});
}
