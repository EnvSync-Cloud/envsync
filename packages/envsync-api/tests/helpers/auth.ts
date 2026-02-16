/**
 * Auth helpers for mock tests.
 *
 * Mock token convention: "test-token-<auth_service_id>"
 * The mocked verifyJWTToken (in setup.ts) strips the prefix to get the `sub`.
 */
import { randomUUID } from "node:crypto";

import { DB } from "@/libs/db";

/**
 * Generate a mock JWT token for a given auth_service_id.
 */
export function mockToken(authServiceId: string): string {
	return `test-token-${authServiceId}`;
}

/**
 * Create a test API key directly in the DB.
 * Returns the raw key string to use in X-API-Key header.
 */
export async function createTestApiKey(
	userId: string,
	orgId: string,
	overrides?: { description?: string },
): Promise<{ id: string; key: string }> {
	const db = await DB.getInstance();
	const keyId = randomUUID();
	const key = `eVs_test_${randomUUID().replace(/-/g, "")}`;

	await db
		.insertInto("api_keys")
		.values({
			id: keyId,
			org_id: orgId,
			user_id: userId,
			key,
			description: overrides?.description ?? "Test API key",
			is_active: true,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	return { id: keyId, key };
}
