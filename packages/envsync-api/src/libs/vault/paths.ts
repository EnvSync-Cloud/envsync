import { config } from "@/utils/env";

const getMountPath = () => config.VAULT_MOUNT_PATH || "envsync";

export const envPath = (org_id: string, app_id: string, env_type_id: string, key: string) =>
	`${getMountPath()}/${org_id}/${app_id}/env/${env_type_id}/${key}`;

export const secretPath = (org_id: string, app_id: string, env_type_id: string, key: string) =>
	`${getMountPath()}/${org_id}/${app_id}/secret/${env_type_id}/${key}`;

export const envScopePath = (org_id: string, app_id: string, env_type_id: string) =>
	`${getMountPath()}/${org_id}/${app_id}/env/${env_type_id}`;

export const secretScopePath = (org_id: string, app_id: string, env_type_id: string) =>
	`${getMountPath()}/${org_id}/${app_id}/secret/${env_type_id}`;
