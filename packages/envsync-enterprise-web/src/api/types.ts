import type {
  EnvTypeMapping,
  IntegrationBinding,
  OrgSecret,
  ProviderConnection,
  SyncAuditEvent,
  SyncRun,
} from "@envsync-cloud/envsync-management-ts-sdk";

export type EnterpriseProvider =
  | "github"
  | "gitlab"
  | "aws-ssm"
  | "vercel"
  | "google-secret-manager"
  | "circleci"
  | "jenkins"
  | "azure-devops"
  | "bitbucket"
  | "travisci"
  | "netlify"
  | "railway"
  | "fly-io"
  | "render"
  | "supabase"
  | "digitalocean-app-platform"
  | "azure-key-vault"
  | "aws-secrets-manager"
  | "cloudflare-workers"
  | "azure-app-service"
  | "codefresh"
  | "deno-deploy"
  | "harness"
  | "hasura-cloud"
  | "heroku"
  | "laravel-forge"
  | "qovery"
  | "terraform-cloud";

export type {
  EnvTypeMapping,
  IntegrationBinding,
  OrgSecret,
  ProviderConnection,
  SyncAuditEvent,
  SyncRun,
};
