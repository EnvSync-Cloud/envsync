import { DB } from "@/libs/db";

import type { OrgBootstrapSession } from "./org-session";

export async function saveOrgBootstrapSession(orgId: string, session: OrgBootstrapSession): Promise<void> {
	if (!orgId || !session.token) {
		return;
	}
	const db = await DB.getInstance();
	const now = new Date();
	await db
		.insertInto("minikms_org_sessions")
		.values({
			org_id: orgId,
			session_token: session.token,
			member_serial: session.memberSerial,
			created_at: now,
		})
		.onConflict(oc => oc.column("org_id").doUpdateSet({
			session_token: session.token,
			member_serial: session.memberSerial,
			created_at: now,
		}))
		.execute();
}

export async function loadOrgBootstrapSession(orgId: string): Promise<OrgBootstrapSession | undefined> {
	if (!orgId) {
		return undefined;
	}
	const db = await DB.getInstance();
	const row = await db
		.selectFrom("minikms_org_sessions")
		.select(["session_token", "member_serial"])
		.where("org_id", "=", orgId)
		.executeTakeFirst();
	if (!row?.session_token) {
		return undefined;
	}
	return {
		token: row.session_token,
		memberSerial: row.member_serial,
	};
}
