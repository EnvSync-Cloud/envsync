/**
 * Test request wrapper — uses Hono's app.request() for in-process testing.
 */
import { app } from "@/app";

export interface TestRequestOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
	token?: string;
	apiKey?: string;
	query?: Record<string, string>;
}

export interface TestResponse {
	status: number;
	json: <T = any>() => Promise<T>;
	text: () => Promise<string>;
	headers: Headers;
	raw: Response;
}

export async function testRequest(
	path: string,
	options: TestRequestOptions = {},
): Promise<TestResponse> {
	const { method = "GET", headers = {}, body, token, apiKey, query } = options;

	const reqHeaders: Record<string, string> = { ...headers };
	if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
	if (apiKey) reqHeaders["X-API-Key"] = apiKey;
	if (body && !reqHeaders["Content-Type"]) reqHeaders["Content-Type"] = "application/json";

	let url = `http://localhost${path}`;
	if (query) {
		const qs = new URLSearchParams(query).toString();
		url += `?${qs}`;
	}

	const res = await app.request(url, {
		method,
		headers: reqHeaders,
		body: body ? JSON.stringify(body) : undefined,
	});

	return {
		status: res.status,
		json: <T = any>() => res.json() as Promise<T>,
		text: () => res.text(),
		headers: res.headers,
		raw: res,
	};
}
