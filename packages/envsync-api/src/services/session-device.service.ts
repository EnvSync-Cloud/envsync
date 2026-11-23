import { randomUUID } from "node:crypto";

import { DB } from "@/libs/db";
import { AppError } from "@/libs/errors";

const touchIntervalMs = 60_000;

export type SessionDeviceRecord = {
	id: string;
	directory_user_id: string;
	user_id: string | null;
	client_id: string;
	jkt: string;
	label: string;
	created_at: Date;
	last_used_at: Date;
	revoked_at: Date | null;
};

function isUniqueViolation(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: string }).code === "23505"
	);
}

function unknownDevice() {
	return new AppError(
		"This device is not registered for the session. Sign in again.",
		401,
		"DPOP_UNKNOWN_DEVICE",
	);
}

function revokedDevice() {
	return new AppError("This device was signed out. Sign in again.", 401, "DPOP_REVOKED");
}

export class SessionDeviceService {
	static async assertActive(directoryUserId: string, jkt: string) {
		if (!directoryUserId || !jkt) {
			throw unknownDevice();
		}

		const db = await DB.getInstance();
		const active = await db
			.selectFrom("session_devices")
			.select("id")
			.where("directory_user_id", "=", directoryUserId)
			.where("jkt", "=", jkt)
			.where("revoked_at", "is", null)
			.executeTakeFirst();
		if (active) return;

		const revoked = await db
			.selectFrom("session_devices")
			.select("id")
			.where("directory_user_id", "=", directoryUserId)
			.where("jkt", "=", jkt)
			.where("revoked_at", "is not", null)
			.executeTakeFirst();
		if (revoked) {
			throw revokedDevice();
		}

		throw unknownDevice();
	}

	/**
	 * Records a device seen with a session.
	 * Issuance passes `createIfMissing` (the default) so the row exists before later requests.
	 * Ordinary session requests pass `createIfMissing: false` and only refresh `last_used_at`.
	 */
	static async touch(
		input: {
			directoryUserId: string;
			userId: string | null;
			clientId: string;
			jkt: string;
			label: string;
		},
		options?: { createIfMissing?: boolean },
	): Promise<void> {
		if (!input.directoryUserId || !input.jkt) return;
		const createIfMissing = options?.createIfMissing !== false;
		const db = await DB.getInstance();
		const now = new Date();
		const active = await db
			.selectFrom("session_devices")
			.select(["id", "last_used_at"])
			.where("directory_user_id", "=", input.directoryUserId)
			.where("jkt", "=", input.jkt)
			.where("revoked_at", "is", null)
			.executeTakeFirst();

		if (active) {
			if (now.getTime() - new Date(active.last_used_at).getTime() < touchIntervalMs) return;
			await db
				.updateTable("session_devices")
				.set({
					last_used_at: now,
					...(input.userId ? { user_id: input.userId } : {}),
				})
				.where("id", "=", active.id)
				.execute();
			return;
		}

		const revoked = await db
			.selectFrom("session_devices")
			.select("id")
			.where("directory_user_id", "=", input.directoryUserId)
			.where("jkt", "=", input.jkt)
			.where("revoked_at", "is not", null)
			.executeTakeFirst();
		if (revoked) {
			throw revokedDevice();
		}

		if (!createIfMissing) return;

		try {
			await db
				.insertInto("session_devices")
				.values({
					id: randomUUID(),
					directory_user_id: input.directoryUserId,
					user_id: input.userId,
					client_id: input.clientId,
					jkt: input.jkt,
					label: input.label,
					created_at: now,
					last_used_at: now,
					revoked_at: null,
				})
				.execute();
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
		}
	}

	static async list(directoryUserId: string, currentJkt = "") {
		const db = await DB.getInstance();
		const rows = await db
			.selectFrom("session_devices")
			.select(["id", "label", "client_id", "jkt", "created_at", "last_used_at"])
			.where("directory_user_id", "=", directoryUserId)
			.where("revoked_at", "is", null)
			.orderBy("last_used_at", "desc")
			.execute();

		return rows.map(row => ({
			id: row.id,
			label: row.label,
			client_id: row.client_id,
			created_at: row.created_at,
			last_used_at: row.last_used_at,
			current: currentJkt !== "" && row.jkt === currentJkt,
		}));
	}

	static async revoke(directoryUserId: string, deviceId: string, currentJkt = "") {
		const db = await DB.getInstance();
		const row = await db
			.selectFrom("session_devices")
			.select(["id", "jkt", "label", "revoked_at"])
			.where("id", "=", deviceId)
			.where("directory_user_id", "=", directoryUserId)
			.executeTakeFirst();
		if (!row || row.revoked_at) {
			throw new AppError("Device not found", 404, "NOT_FOUND");
		}

		await db
			.updateTable("session_devices")
			.set({ revoked_at: new Date() })
			.where("id", "=", row.id)
			.where("revoked_at", "is", null)
			.execute();

		return {
			id: row.id,
			label: row.label,
			jkt: row.jkt,
			current: currentJkt !== "" && row.jkt === currentJkt,
		};
	}

	static async revokeThumbprint(directoryUserId: string, jkt: string) {
		if (!directoryUserId || !jkt) return;
		const db = await DB.getInstance();
		await db
			.updateTable("session_devices")
			.set({ revoked_at: new Date() })
			.where("directory_user_id", "=", directoryUserId)
			.where("jkt", "=", jkt)
			.where("revoked_at", "is", null)
			.execute();
	}
}
