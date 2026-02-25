/**
 * Auth helpers for mock tests.
 *
 * Mock token convention: "test-token-<auth_service_id>"
 * The mocked verifyJWTToken (in setup.ts) strips the prefix to get the `sub`.
 */
import { randomUUID } from "node:crypto";

import { STDBClient } from "@/libs/stdb";

/**
 * Generate a mock JWT token for a given auth_service_id.
 */
export function mockToken(authServiceId: string): string {
	return `test-token-${authServiceId}`;
}

/**
 * Create a test API key directly in STDB.
 * Returns the raw key string to use in X-API-Key header.
 */
export async function createTestApiKey(
	userId: string,
	orgId: string,
	overrides?: { description?: string },
): Promise<{ id: string; key: string }> {
	const stdb = STDBClient.getInstance();
	const keyId = randomUUID();
	const key = `eVs_test_${randomUUID().replace(/-/g, "")}`;

	await stdb.callReducer("create_api_key", [
		keyId,
		orgId,
		userId,
		key,
		overrides?.description ?? "Test API key",
		true,
	]);

	return { id: keyId, key };
}
