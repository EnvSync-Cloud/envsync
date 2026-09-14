import z from "zod";

import { AuditActions } from "@/lib/audit.type";

export const ActionCategories = z.enum([
  "app*",
  "audit_log*",
  "env*",
  "env_store*",
  "secret_store*",
  "onboarding*",
  "org*",
  "role*",
  "user*",
  "api_key*",
  "webhook*",
  "cli*",
]);

export type ActionCtgs = z.infer<typeof ActionCategories>;

export const ActionPastTimeOptions = z.enum([
  "last_3_hours",
  "last_24_hours",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "last_180_days",
  "last_1_year",
  "all_time",
]);

export type ActionPastTimes = z.infer<typeof ActionPastTimeOptions>;

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export const TIME_RANGE_OPTIONS = [
  { value: "last_3_hours", label: "Last 3 Hours" },
  { value: "last_24_hours", label: "Last 24 Hours" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "last_180_days", label: "Last 180 Days" },
  { value: "last_1_year", label: "Last 1 Year" },
  { value: "all_time", label: "All Time" },
] as const;

export const RESOURCE_TYPE_OPTIONS: {
  value: z.infer<typeof ActionCategories> | "all";
  label: string;
}[] = [
  { value: "all", label: "All Resources" },
  { value: "app*", label: "Applications" },
  { value: "env*", label: "Variables" },
  { value: "user*", label: "Users" },
  { value: "org*", label: "Organizations" },
  { value: "api_key*", label: "API Keys" },
  { value: "cli*", label: "CLI Commands" },
  { value: "audit_log*", label: "Audit Logs" },
  { value: "env_store*", label: "Environment Store" },
  { value: "secret_store*", label: "Secret Store" },
  { value: "webhook*", label: "Webhooks" },
  { value: "role*", label: "Roles" },
  { value: "onboarding*", label: "Onboarding" },
];

const ACTION_CATEGORIES = {
  create: [
    "app_created",
    "env_created",
    "envs_batch_created",
    "org_created",
    "user_invite_created",
  ],
  update: [
    "app_updated",
    "env_updated",
    "envs_batch_updated",
    "org_updated",
    "user_updated",
    "user_role_updated",
    "user_invite_updated",
  ],
  delete: ["app_deleted", "env_deleted", "user_deleted", "user_invite_deleted"],
  view: [
    "app_viewed",
    "apps_viewed",
    "env_type_viewed",
    "env_types_viewed",
    "env_viewed",
    "envs_viewed",
    "user_invite_viewed",
    "users_retrieved",
    "user_retrieved",
    "get_audit_logs",
  ],
  auth: ["user_invite_accepted", "password_update_requested"],
  cli: ["cli_command_executed"],
} as const;

export function getActionDescription(action: AuditActions): string {
  const descriptions: Record<string, string> = {
    app_created: "Created application",
    app_updated: "Updated application",
    app_deleted: "Deleted application",
    app_viewed: "Viewed application",
    apps_viewed: "Viewed applications list",
    env_types_viewed: "Viewed environment types",
    env_type_viewed: "Viewed environment type",
    env_created: "Created variable",
    env_updated: "Updated variable",
    env_deleted: "Deleted variable",
    env_viewed: "Viewed variable",
    envs_viewed: "Viewed variables",
    envs_batch_created: "Created multiple variables",
    envs_batch_updated: "Updated multiple variables",
    envs_batch_deleted: "Deleted multiple variables",
    envs_rollback_pit: "Rolled back variables to PIT",
    env_variable_rollback_pit: "Rolled back variable to PIT",
    envs_rollback_timestamp: "Rolled back variables to timestamp",
    env_variable_rollback_timestamp: "Rolled back variable to timestamp",
    env_variable_diff_viewed: "Viewed variable diff",
    env_variable_timeline_viewed: "Viewed variable timeline",
    env_variable_history_viewed: "Viewed variable history",
    envs_pit_viewed: "Viewed variables PIT",
    envs_timestamp_viewed: "Viewed variables timestamp",
    env_type_created: "Created environment type",
    env_type_updated: "Updated environment type",
    env_type_deleted: "Deleted environment type",
    users_retrieved: "Retrieved users list",
    user_retrieved: "Retrieved user details",
    user_updated: "Updated user profile",
    user_deleted: "Deleted user account",
    user_role_updated: "Updated user role",
    password_update_requested: "Requested password update",
    org_created: "Created organization",
    org_updated: "Updated organization",
    user_invite_created: "Created user invitation",
    user_invite_accepted: "Accepted user invitation",
    user_invite_viewed: "Viewed user invitation",
    user_invite_updated: "Updated user invitation",
    user_invite_deleted: "Deleted user invitation",
    user_invites_retrieved: "Retrieved user invitations list",
    get_audit_logs: "Viewed audit logs",
    cli_command_executed: "Executed CLI command",
    apikey_created: "Created API key",
    apikey_deleted: "Deleted API key",
    apikey_viewed: "Viewed API key",
    apikeys_viewed: "Viewed API keys list",
    apikey_regenerated: "Regenerated API key",
    apikey_updated: "Updated API key",
    webhook_created: "Created webhook",
    webhook_updated: "Updated webhook",
    webhook_deleted: "Deleted webhook",
    webhook_triggered: "Triggered webhook",
    webhook_viewed: "Viewed webhook",
    webhooks_viewed: "Viewed webhooks list",
    secret_created: "Created secret",
    secret_deleted: "Deleted secret",
    secret_updated: "Updated secret",
    secret_viewed: "Viewed secret",
    secrets_viewed: "Viewed secrets list",
    secrets_batch_created: "Created multiple secrets",
    secrets_batch_updated: "Updated multiple secrets",
    secrets_batch_deleted: "Deleted multiple secrets",
    secrets_rollback_pit: "Rolled back secrets to PIT",
    secrets_rollback_timestamp: "Rolled back secrets to timestamp",
    secret_variable_rollback_pit: "Rolled back secret variable to PIT",
    secret_variable_rollback_timestamp: "Rolled back secret variable to timestamp",
    secret_history_viewed: "Viewed secret history",
    secret_variable_history_viewed: "Viewed secret variable history",
    secret_diff_viewed: "Viewed secret diff",
    secret_timeline_viewed: "Viewed secret timeline",
    secrets_pit_viewed: "Viewed secrets PIT",
    secrets_timestamp_viewed: "Viewed secrets timestamp",
    roles_viewed: "Viewed roles",
    role_viewed: "Viewed role",
    role_created: "Created role",
    role_updated: "Updated role",
    role_deleted: "Deleted role",
  };
  return (
    descriptions[action] ||
    action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

export function getActionCategory(
  action: AuditActions
): keyof typeof ACTION_CATEGORIES {
  for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
    if (actions.includes(action as never)) {
      return category as keyof typeof ACTION_CATEGORIES;
    }
  }
  return "view";
}

export function getResourceTypeFromAction(action: AuditActions): string {
  for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
    if (actions.includes(action as never)) {
      return category;
    }
  }
  return "view";
}

export function getActionBadgeColor(action: AuditActions): string {
  const category = getActionCategory(action);
  switch (category) {
    case "create":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "update":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "delete":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "view":
      return "bg-muted/10 text-muted-foreground border-border";
    case "auth":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "cli":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    default:
      return "bg-muted/10 text-muted-foreground border-border";
  }
}
