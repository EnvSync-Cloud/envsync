import { v4 as uuidv4 } from "uuid";
import { SecretKeyGenerator } from "sk-keygen";

import { DB } from "@/libs/db";
import { ConflictError } from "@/libs/errors";
import { PlanLimitService } from "@/services/plan_limit.service";

export class InviteService {
	public static normalizeEmail(email: string) {
		return email.trim().toLowerCase();
	}

	public static async findUsersByEmail(email: string) {
		const db = await DB.getInstance();
		return db
			.selectFrom("users")
			.selectAll()
			.where("email", "ilike", this.normalizeEmail(email))
			.execute();
	}
	public static createOrgInvite = async (email: string) => {
		const db = await DB.getInstance();
		const [existingInvite, existingUser] = await Promise.all([
			db
				.selectFrom("invite_org")
				.select(["id", "is_accepted"])
				.where("email", "=", email)
				.executeTakeFirst(),
			db
				.selectFrom("users")
				.select("id")
				.where("email", "=", email)
				.executeTakeFirst(),
		]);

		if (existingInvite && !existingInvite.is_accepted) {
			throw new ConflictError("An organization invite is already pending for this email.", "INVITE_ALREADY_SENT");
		}
		if (existingInvite?.is_accepted) {
			throw new ConflictError("This email has already completed organization onboarding.", "ORG_ALREADY_ONBOARDED");
		}
		if (existingUser) {
			throw new ConflictError("An account already exists for this email.", "ACCOUNT_ALREADY_EXISTS");
		}

		const { invite_token } = await db
			.insertInto("invite_org")
			.values({
				id: uuidv4(),
				email,
				invite_token: SecretKeyGenerator.generateKey(),
				is_accepted: false,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		return invite_token;
	};

	public static createUserInvite = async (email: string, org_id: string, role_id: string) => {
		const db = await DB.getInstance();
		const normalized = this.normalizeEmail(email);
		await PlanLimitService.assertCount(org_id, "members");

		const existingUsers = await this.findUsersByEmail(normalized);
		if (existingUsers.some(user => user.org_id === org_id)) {
			throw new ConflictError(
				"This person is already a member of this organization.",
				"ALREADY_A_MEMBER",
			);
		}

		const existingInvite = await db
			.selectFrom("invite_user")
			.select("id")
			.where("email", "ilike", normalized)
			.where("org_id", "=", org_id)
			.where("is_accepted", "=", false)
			.executeTakeFirst();

		if (existingInvite) {
			throw new ConflictError("An invitation is already pending for this email in this organization.", "INVITE_ALREADY_SENT");
		}

		const { id, invite_token } = await db
			.insertInto("invite_user")
			.values({
				id: uuidv4(),
				email: normalized,
				invite_token: SecretKeyGenerator.generateKey(),
				is_accepted: false,
				org_id,
				role_id,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		return { invite_token, id, account_exists: existingUsers.length > 0 };
	};

	public static getOrgInviteByCode = async (invite_code: string) => {
		const db = await DB.getInstance();
		const invite = await db
			.selectFrom("invite_org")
			.selectAll()
			.where("invite_token", "=", invite_code)
			.executeTakeFirstOrThrow();

		return invite;
	};

	public static getUserInviteByCode = async (invite_code: string) => {
		const db = await DB.getInstance();
		const invite = await db
			.selectFrom("invite_user")
			.selectAll()
			.where("invite_token", "=", invite_code)
			.executeTakeFirstOrThrow();

		return invite;
	};

	public static deleteInvite = async (invite_id: string) => {
		const db = await DB.getInstance();
		await db.deleteFrom("invite_org").where("id", "=", invite_id).executeTakeFirstOrThrow();
	};

	public static deleteUserInvite = async (invite_id: string) => {
		const db = await DB.getInstance();
		await db.deleteFrom("invite_user").where("id", "=", invite_id).executeTakeFirstOrThrow();
	};

	public static getAllUserInvites = async (org_id: string) => {
		await this.reconcileAcceptedInvites(org_id);
		const db = await DB.getInstance();
		const invites = await db
			.selectFrom("invite_user")
			.where("org_id", "=", org_id)
			.selectAll()
			.execute();

		return invites;
	};

	/**
	 * If a pending invite's email already has a membership in this org, mark
	 * the invite accepted. Accept used to create the membership first and
	 * only then flip is_accepted, so a later PKI failure left split-brain rows.
	 */
	public static reconcileAcceptedInvites = async (org_id: string) => {
		const db = await DB.getInstance();
		const pending = await db
			.selectFrom("invite_user")
			.select(["id", "email"])
			.where("org_id", "=", org_id)
			.where("is_accepted", "=", false)
			.execute();
		if (pending.length === 0) {
			return 0;
		}

		const members = await db
			.selectFrom("users")
			.select("email")
			.where("org_id", "=", org_id)
			.execute();
		const memberEmails = new Set(members.map(row => this.normalizeEmail(row.email)));
		const matched = pending.filter(invite => memberEmails.has(this.normalizeEmail(invite.email)));
		if (matched.length === 0) {
			return 0;
		}

		await db
			.updateTable("invite_user")
			.set({ is_accepted: true, updated_at: new Date() })
			.where(
				"id",
				"in",
				matched.map(invite => invite.id),
			)
			.execute();
		return matched.length;
	};

	public static updateOrgInvite = async (
		invite_id: string,
		data: {
			is_accepted?: boolean;
		},
	) => {
		const db = await DB.getInstance();
		await db
			.updateTable("invite_org")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", invite_id)
			.executeTakeFirstOrThrow();
	};

	public static updateUserInvite = async (
		invite_id: string,
		data: {
			is_accepted?: boolean;
			role_id?: string;
		},
	) => {
		const db = await DB.getInstance();
		await db
			.updateTable("invite_user")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", invite_id)
			.executeTakeFirstOrThrow();
	};

	public static getUserInviteById = async (invite_id: string) => {
		const db = await DB.getInstance();
		const invite = await db
			.selectFrom("invite_user")
			.selectAll()
			.where("id", "=", invite_id)
			.executeTakeFirstOrThrow();

		return invite;
	};
}
