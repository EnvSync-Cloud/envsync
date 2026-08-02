import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";
import { EditionPolicyService } from "@/services/edition-policy.service";

const INSTALL_STATE_ID = "default";

export class SystemStateService {
	public static async getInstallState() {
		const db = await DB.getInstance();
		let state = await db
			.selectFrom("install_state")
			.selectAll()
			.where("id", "=", INSTALL_STATE_ID)
			.executeTakeFirst();

		if (!state) {
			const now = new Date();
			await db
				.insertInto("install_state")
				.values({
					id: INSTALL_STATE_ID,
					edition: EditionPolicyService.getEdition(),
					first_bootstrap_completed_at: null,
					single_org_mode: EditionPolicyService.isSingleOrgMode(),
					management_enabled: EditionPolicyService.isManagementEnabled(),
					observability_enabled: EditionPolicyService.isObservabilityEnabled(),
					management_web_enabled: EditionPolicyService.isManagementWebEnabled(),
					landing_enabled: EditionPolicyService.isLandingEnabled(),
					created_at: now,
					updated_at: now,
				})
				.onConflict((oc) => oc.column("id").doNothing())
				.execute();

			state = await db
				.selectFrom("install_state")
				.selectAll()
				.where("id", "=", INSTALL_STATE_ID)
				.executeTakeFirstOrThrow();
		}

		return state;
	}

	public static async updateInstallState(data: {
		first_bootstrap_completed_at?: Date | null;
		single_org_mode?: boolean;
		management_enabled?: boolean;
		observability_enabled?: boolean;
		management_web_enabled?: boolean;
		landing_enabled?: boolean;
		edition?: "oss" | "enterprise";
	}) {
		const db = await DB.getInstance();
		await this.getInstallState();
		await db
			.updateTable("install_state")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", INSTALL_STATE_ID)
			.executeTakeFirstOrThrow();

		return this.getInstallState();
	}

	public static async markBootstrapCompleted() {
		const state = await this.getInstallState();
		if (state.first_bootstrap_completed_at) {
			return state;
		}

		return this.updateInstallState({
			first_bootstrap_completed_at: new Date(),
		});
	}

	public static async getSystemStatus() {
		const db = await DB.getInstance();
		const [installState, orgCountResult] = await Promise.all([
			this.getInstallState(),
			db
				.selectFrom("orgs")
				.select(({ fn }) => fn.count<string>("id").as("count"))
				.executeTakeFirstOrThrow(),
		]);

		const policy = EditionPolicyService.getPolicySnapshot();

		return {
			...installState,
			// Live policy wins over persisted install_state for channel flags
			edition: policy.edition,
			single_org_mode: policy.single_org_mode,
			management_enabled: policy.management_enabled,
			observability_enabled: policy.observability_enabled,
			management_web_enabled: policy.management_web_enabled,
			landing_enabled: policy.landing_enabled,
			deployment_mode: policy.deployment_mode,
			max_orgs: policy.max_orgs,
			public_signup_enabled: policy.public_signup_enabled,
			can_create_organization: policy.can_create_organization,
			org_count: Number(orgCountResult.count),
		};
	}

	public static buildProvisioningMetadata(source: string) {
		return {
			provisioned_by: source,
			provisioning_run_id: uuidv4(),
		};
	}
}
