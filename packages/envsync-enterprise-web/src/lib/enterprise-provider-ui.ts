import type { EnterpriseProvider } from "../api/types";

export type ProviderFieldKind = "text" | "select" | "secret-ref";

export interface ProviderFieldOption {
  label: string;
  value: string;
}

export interface ProviderFieldConfig {
  key: string;
  label: string;
  kind: ProviderFieldKind;
  placeholder?: string;
  helper?: string;
  options?: ProviderFieldOption[];
}

export interface ProviderUiConfig {
  id: EnterpriseProvider;
  name: string;
  description: string;
  title: string;
  providerHeadline: string;
  targetLabel: string;
  helper: string;
  branchLabel: string;
  targetPlaceholder: string;
  branchPlaceholder: string;
  pathLabel: string;
  pathPlaceholder: string;
  usesBranch: boolean;
  usesPath: boolean;
  connectionAuthFields: ProviderFieldConfig[];
  connectionMetadataFields: ProviderFieldConfig[];
  bindingFields: ProviderFieldConfig[];
  mappingFields: ProviderFieldConfig[];
}

const yesNoOptions: ProviderFieldOption[] = [
  { label: "Not set", value: "" },
  { label: "yes", value: "yes" },
  { label: "no", value: "no" },
];

const secretPrefixField: ProviderFieldConfig = {
  key: "secret_name_template",
  label: "Secret name template",
  kind: "text",
  placeholder: "{{app}}_{{env}}_{{key}}",
  helper: "Optional template for remote secret names.",
};

export const enterpriseProviderUi: Record<EnterpriseProvider, ProviderUiConfig> = {
  github: {
    id: "github",
    name: "GitHub",
    description: "Map environment types to GitHub repositories, branches, and repo secrets.",
    title: "GitHub repository mapping",
    providerHeadline: "Register the GitHub account context and how EnvSync should name repository secrets by default.",
    targetLabel: "Repository target",
    helper: "Bind a GitHub connection to this app, then decide which repository and branch should receive each environment type.",
    branchLabel: "Branch or ref",
    targetPlaceholder: "owner/repository",
    branchPlaceholder: "main",
    pathLabel: "Path prefix",
    pathPlaceholder: "Not used for GitHub",
    usesBranch: true,
    usesPath: false,
    connectionAuthFields: [
      { key: "owner", label: "Owner or org", kind: "text", placeholder: "envsync-cloud" },
      { key: "token_secret_ref", label: "Token secret ref", kind: "secret-ref", placeholder: "github-token" },
      { key: "installation_id", label: "Installation ID", kind: "text", placeholder: "123456" },
      { key: "app_id", label: "GitHub App ID", kind: "text", placeholder: "98765" },
    ],
    connectionMetadataFields: [
      { key: "repository_visibility", label: "Repository visibility", kind: "select", options: [
        { label: "Not set", value: "" },
        { label: "private", value: "private" },
        { label: "internal", value: "internal" },
        { label: "public", value: "public" },
      ]},
      { key: "default_secret_prefix", label: "Default secret prefix", kind: "text", placeholder: "ENVSYNC" },
      secretPrefixField,
    ],
    bindingFields: [
      { key: "repository_visibility", label: "Repository visibility", kind: "select", options: [
        { label: "Not set", value: "" },
        { label: "private", value: "private" },
        { label: "internal", value: "internal" },
        { label: "public", value: "public" },
      ]},
      { key: "default_secret_prefix", label: "Default secret prefix", kind: "text", placeholder: "ENVSYNC" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "environment_label", label: "Environment label", kind: "text", placeholder: "production" },
    ],
  },
  gitlab: {
    id: "gitlab",
    name: "GitLab",
    description: "Tie this app to GitLab projects or group variables with branch-aware targeting.",
    title: "GitLab project mapping",
    providerHeadline: "Capture GitLab group or project access and the variable conventions this org wants to use.",
    targetLabel: "Project target",
    helper: "Use the app context to choose which GitLab project or group variable path owns each environment type.",
    branchLabel: "Branch or ref",
    targetPlaceholder: "group/project",
    branchPlaceholder: "main",
    pathLabel: "Path prefix",
    pathPlaceholder: "Not used for GitLab",
    usesBranch: true,
    usesPath: false,
    connectionAuthFields: [
      { key: "group_path", label: "Group path", kind: "text", placeholder: "platform/team" },
      { key: "token_secret_ref", label: "Token secret ref", kind: "secret-ref", placeholder: "gitlab-token" },
      { key: "account", label: "Account label", kind: "text", placeholder: "prod-gitlab" },
    ],
    connectionMetadataFields: [
      { key: "variable_scope", label: "Default variable scope", kind: "text", placeholder: "*" },
      { key: "secret_name_template", label: "Variable name template", kind: "text", placeholder: "{{app}}_{{env}}_{{key}}" },
      { key: "masked_by_default", label: "Mask variables by default", kind: "select", options: yesNoOptions },
    ],
    bindingFields: [
      { key: "group_path", label: "Group path", kind: "text", placeholder: "platform/team" },
      { key: "variable_scope", label: "Default variable scope", kind: "text", placeholder: "*" },
      secretPrefixField,
    ],
    mappingFields: [
      { key: "variable_scope", label: "Variable scope", kind: "text", placeholder: "production" },
      secretPrefixField,
    ],
  },
  vercel: {
    id: "vercel",
    name: "Vercel",
    description: "Route env types into Vercel projects and deployment environments.",
    title: "Vercel environment mapping",
    providerHeadline: "Store the Vercel token reference and the default team or project identifiers for this org.",
    targetLabel: "Project target",
    helper: "Choose the Vercel project binding for this app, then route env types into the correct Vercel environment.",
    branchLabel: "Vercel environment",
    targetPlaceholder: "project-slug",
    branchPlaceholder: "preview",
    pathLabel: "Path prefix",
    pathPlaceholder: "Not used for Vercel",
    usesBranch: true,
    usesPath: false,
    connectionAuthFields: [
      { key: "token_secret_ref", label: "Token secret ref", kind: "secret-ref", placeholder: "vercel-token" },
      { key: "team_id", label: "Team ID", kind: "text", placeholder: "team_123" },
      { key: "project_id", label: "Default project ID", kind: "text", placeholder: "prj_123" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
      { key: "create_preview_alias", label: "Create preview alias", kind: "select", options: yesNoOptions },
      { key: "default_environment", label: "Default environment", kind: "text", placeholder: "preview" },
    ],
    bindingFields: [
      { key: "team_id", label: "Team ID", kind: "text", placeholder: "team_123" },
      { key: "project_id", label: "Default Vercel project ID", kind: "text", placeholder: "prj_123" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "create_preview_alias", label: "Create preview alias", kind: "select", options: yesNoOptions },
    ],
  },
  "aws-ssm": {
    id: "aws-ssm",
    name: "AWS SSM",
    description: "Define Parameter Store path strategies and prefixes per environment type.",
    title: "AWS SSM path mapping",
    providerHeadline: "Define the AWS account credentials, region, and Parameter Store path strategy for this connection.",
    targetLabel: "Parameter namespace",
    helper: "Use binding settings for region and key strategy, then map each env type to the correct Parameter Store path prefix.",
    branchLabel: "Branch hint",
    targetPlaceholder: "service/api",
    branchPlaceholder: "Optional release branch hint",
    pathLabel: "Parameter path prefix",
    pathPlaceholder: "/envsync/prod/api",
    usesBranch: true,
    usesPath: true,
    connectionAuthFields: [
      { key: "region", label: "AWS region", kind: "text", placeholder: "ap-south-1" },
      { key: "credential_secret_ref", label: "Credential secret ref", kind: "secret-ref", placeholder: "aws-ssm-credentials" },
      { key: "role_arn", label: "Role ARN", kind: "text", placeholder: "arn:aws:iam::123456789012:role/envsync-sync" },
    ],
    connectionMetadataFields: [
      { key: "kms_key_id", label: "KMS key ID", kind: "text", placeholder: "alias/envsync-ssm" },
      { key: "path_strategy", label: "Path strategy", kind: "select", options: [
        { label: "Not set", value: "" },
        { label: "hierarchical", value: "hierarchical" },
        { label: "flat", value: "flat" },
        { label: "per-env", value: "per-env" },
      ]},
      { key: "overwrite_existing", label: "Overwrite existing params", kind: "select", options: yesNoOptions },
    ],
    bindingFields: [
      { key: "region", label: "AWS region", kind: "text", placeholder: "ap-south-1" },
      { key: "kms_key_id", label: "KMS key ID", kind: "text", placeholder: "alias/envsync-ssm" },
      { key: "path_strategy", label: "Path strategy", kind: "select", options: [
        { label: "Not set", value: "" },
        { label: "hierarchical", value: "hierarchical" },
        { label: "flat", value: "flat" },
        { label: "per-env", value: "per-env" },
      ]},
    ],
    mappingFields: [
      { key: "parameter_tier", label: "Parameter tier", kind: "select", options: [
        { label: "Not set", value: "" },
        { label: "Standard", value: "Standard" },
        { label: "Advanced", value: "Advanced" },
        { label: "Intelligent-Tiering", value: "Intelligent-Tiering" },
      ]},
      { key: "env_key_prefix", label: "Key prefix", kind: "text", placeholder: "APP_" },
    ],
  },
  "google-secret-manager": {
    id: "google-secret-manager",
    name: "Google Secret Manager",
    description: "Target GCP projects and namespace strategies for secret sync.",
    title: "Google Secret Manager mapping",
    providerHeadline: "Capture the GCP project context and the secret reference that allows writes into Secret Manager.",
    targetLabel: "GCP project or namespace",
    helper: "Choose the Google Secret Manager connection and decide which project or namespace receives each environment type.",
    branchLabel: "Branch hint",
    targetPlaceholder: "my-gcp-project",
    branchPlaceholder: "Optional branch hint",
    pathLabel: "Secret prefix",
    pathPlaceholder: "prod/api",
    usesBranch: true,
    usesPath: true,
    connectionAuthFields: [
      { key: "project_id", label: "Project ID", kind: "text", placeholder: "my-gcp-project" },
      { key: "service_account_secret_ref", label: "Service account secret ref", kind: "secret-ref", placeholder: "gcp-service-account" },
      { key: "workload_identity_provider", label: "Workload identity provider", kind: "text", placeholder: "projects/.../providers/..." },
    ],
    connectionMetadataFields: [
      { key: "replication_policy", label: "Replication policy", kind: "select", options: [
        { label: "Not set", value: "" },
        { label: "automatic", value: "automatic" },
        { label: "user-managed", value: "user-managed" },
      ]},
      { key: "secret_name_template", label: "Secret name template", kind: "text", placeholder: "{{app}}-{{env}}-{{key}}" },
      { key: "labels_csv", label: "Default labels", kind: "text", placeholder: "team=platform,source=envsync" },
    ],
    bindingFields: [
      { key: "project_id", label: "Default project ID", kind: "text", placeholder: "my-gcp-project" },
      { key: "replication_policy", label: "Replication policy", kind: "select", options: [
        { label: "Not set", value: "" },
        { label: "automatic", value: "automatic" },
        { label: "user-managed", value: "user-managed" },
      ]},
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "labels_csv", label: "Labels", kind: "text", placeholder: "team=platform,source=envsync" },
    ],
  },
  circleci: {
    id: "circleci",
    name: "CircleCI",
    description: "Sync environment variables to CircleCI projects and contexts.",
    title: "CircleCI environment mapping",
    providerHeadline: "Store the CircleCI API token and organization context for this connection.",
    targetLabel: "Project slug",
    helper: "Choose the CircleCI project context, then map each environment type to the correct CircleCI environment.",
    branchLabel: "Branch",
    targetPlaceholder: "gh/org/repo",
    branchPlaceholder: "main",
    pathLabel: "Context path",
    pathPlaceholder: "Not used for CircleCI",
    usesBranch: false,
    usesPath: false,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "circleci-api-token" },
      { key: "org_id", label: "Organization ID", kind: "text", placeholder: "org-uuid" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "project_slug", label: "Project slug", kind: "text", placeholder: "gh/org/repo" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "context_name", label: "Context name", kind: "text", placeholder: "production" },
    ],
  },
  jenkins: {
    id: "jenkins",
    name: "Jenkins",
    description: "Sync credentials to Jenkins credential stores.",
    title: "Jenkins credential mapping",
    providerHeadline: "Store the Jenkins URL and API token for this connection.",
    targetLabel: "Credential store",
    helper: "Choose the Jenkins credential store, then map each environment type to the correct credential scope.",
    branchLabel: "Branch",
    targetPlaceholder: "_",
    branchPlaceholder: "main",
    pathLabel: "Credential prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "jenkins_url", label: "Jenkins URL", kind: "text", placeholder: "https://jenkins.example.com" },
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "jenkins-api-token" },
      { key: "username", label: "Username", kind: "text", placeholder: "admin" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "credential_store", label: "Credential store", kind: "text", placeholder: "_" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "credential_scope", label: "Credential scope", kind: "text", placeholder: "GLOBAL" },
    ],
  },
  "azure-devops": {
    id: "azure-devops",
    name: "Azure DevOps",
    description: "Sync variables to Azure DevOps variable groups.",
    title: "Azure DevOps variable mapping",
    providerHeadline: "Store the Azure DevOps organization and PAT for this connection.",
    targetLabel: "Variable group",
    helper: "Choose the Azure DevOps variable group, then map each environment type to the correct variable scope.",
    branchLabel: "Branch",
    targetPlaceholder: "my-variable-group",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "org_url", label: "Organization URL", kind: "text", placeholder: "https://dev.azure.com/myorg" },
      { key: "pat", label: "Personal access token", kind: "secret-ref", placeholder: "azure-devops-pat" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "project", label: "Project name", kind: "text", placeholder: "my-project" },
      { key: "variable_group_id", label: "Variable group ID", kind: "text", placeholder: "123" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "variable_scope", label: "Variable scope", kind: "text", placeholder: "release" },
    ],
  },
  bitbucket: {
    id: "bitbucket",
    name: "Bitbucket",
    description: "Sync deployment variables to Bitbucket repositories.",
    title: "Bitbucket deployment mapping",
    providerHeadline: "Store the Bitbucket workspace and app password for this connection.",
    targetLabel: "Repository",
    helper: "Choose the Bitbucket repository, then map each environment type to the correct deployment environment.",
    branchLabel: "Branch",
    targetPlaceholder: "my-org/my-repo",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "workspace", label: "Workspace", kind: "text", placeholder: "my-org" },
      { key: "app_password", label: "App password", kind: "secret-ref", placeholder: "bitbucket-app-password" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "repo_slug", label: "Repository slug", kind: "text", placeholder: "my-repo" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "environment", label: "Deployment environment", kind: "text", placeholder: "production" },
    ],
  },
  travisci: {
    id: "travisci",
    name: "Travis CI",
    description: "Sync environment variables to Travis CI repositories.",
    title: "Travis CI environment mapping",
    providerHeadline: "Store the Travis CI API token and organization for this connection.",
    targetLabel: "Repository",
    helper: "Choose the Travis CI repository, then map each environment type to the correct environment.",
    branchLabel: "Branch",
    targetPlaceholder: "my-org/my-repo",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "travis-api-token" },
      { key: "org_id", label: "Organization", kind: "text", placeholder: "my-org" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "repo_slug", label: "Repository slug", kind: "text", placeholder: "my-org/my-repo" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "environment", label: "Environment", kind: "text", placeholder: "production" },
    ],
  },
  netlify: {
    id: "netlify",
    name: "Netlify",
    description: "Sync environment variables to Netlify sites.",
    title: "Netlify environment mapping",
    providerHeadline: "Store the Netlify API token and site context for this connection.",
    targetLabel: "Site",
    helper: "Choose the Netlify site, then map each environment type to the correct environment.",
    branchLabel: "Branch",
    targetPlaceholder: "my-site",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "netlify-api-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "site_id", label: "Site ID", kind: "text", placeholder: "my-site-id" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "context", label: "Deploy context", kind: "text", placeholder: "production" },
    ],
  },
  railway: {
    id: "railway",
    name: "Railway",
    description: "Sync variables to Railway services.",
    title: "Railway variable mapping",
    providerHeadline: "Store the Railway API token and project context for this connection.",
    targetLabel: "Service",
    helper: "Choose the Railway service, then map each environment type to the correct environment.",
    branchLabel: "Branch",
    targetPlaceholder: "my-service",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "railway-api-token" },
      { key: "project_id", label: "Project ID", kind: "text", placeholder: "project-uuid" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "service_id", label: "Service ID", kind: "text", placeholder: "service-uuid" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "environment_id", label: "Environment ID", kind: "text", placeholder: "env-uuid" },
    ],
  },
  "fly-io": {
    id: "fly-io",
    name: "Fly.io",
    description: "Sync secrets to Fly.io applications.",
    title: "Fly.io secrets mapping",
    providerHeadline: "Store the Fly.io API token and app context for this connection.",
    targetLabel: "App",
    helper: "Choose the Fly.io app, then map each environment type to the correct secrets scope.",
    branchLabel: "Branch",
    targetPlaceholder: "my-app",
    branchPlaceholder: "main",
    pathLabel: "Secret prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "flyio-api-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "app_name", label: "App name", kind: "text", placeholder: "my-app" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  render: {
    id: "render",
    name: "Render",
    description: "Sync environment variables to Render services.",
    title: "Render environment mapping",
    providerHeadline: "Store the Render API key and service context for this connection.",
    targetLabel: "Service",
    helper: "Choose the Render service, then map each environment type to the correct environment.",
    branchLabel: "Branch",
    targetPlaceholder: "my-service",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_key", label: "API key", kind: "secret-ref", placeholder: "render-api-key" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "service_id", label: "Service ID", kind: "text", placeholder: "srv-xxx" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  supabase: {
    id: "supabase",
    name: "Supabase",
    description: "Sync secrets to Supabase projects.",
    title: "Supabase secrets mapping",
    providerHeadline: "Store the Supabase access token and project context for this connection.",
    targetLabel: "Project",
    helper: "Choose the Supabase project, then map each environment type to the correct secrets scope.",
    branchLabel: "Branch",
    targetPlaceholder: "my-project",
    branchPlaceholder: "main",
    pathLabel: "Secret prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "access_token", label: "Access token", kind: "secret-ref", placeholder: "supabase-access-token" },
      { key: "project_ref", label: "Project ref", kind: "text", placeholder: "my-project-ref" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "project_ref", label: "Project ref", kind: "text", placeholder: "my-project-ref" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  "digitalocean-app-platform": {
    id: "digitalocean-app-platform",
    name: "DigitalOcean",
    description: "Sync environment variables to DigitalOcean App Platform apps.",
    title: "DigitalOcean app mapping",
    providerHeadline: "Store the DigitalOcean API token and app context for this connection.",
    targetLabel: "App",
    helper: "Choose the DigitalOcean app, then map each environment type to the correct environment.",
    branchLabel: "Branch",
    targetPlaceholder: "my-app",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "do-api-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "app_id", label: "App ID", kind: "text", placeholder: "app-uuid" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
      { key: "environment", label: "Environment", kind: "text", placeholder: "production" },
    ],
  },
  "azure-key-vault": {
    id: "azure-key-vault",
    name: "Azure Key Vault",
    description: "Sync secrets to Azure Key Vault.",
    title: "Azure Key Vault mapping",
    providerHeadline: "Store the Azure credentials and vault context for this connection.",
    targetLabel: "Vault",
    helper: "Choose the Azure Key Vault, then map each environment type to the correct secret scope.",
    branchLabel: "Branch",
    targetPlaceholder: "my-vault",
    branchPlaceholder: "main",
    pathLabel: "Secret prefix",
    pathPlaceholder: "ENVSYNC/",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "tenant_id", label: "Tenant ID", kind: "text", placeholder: "azure-tenant-id" },
      { key: "client_id", label: "Client ID", kind: "text", placeholder: "azure-client-id" },
      { key: "client_secret", label: "Client secret", kind: "secret-ref", placeholder: "azure-client-secret" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "vault_url", label: "Vault URL", kind: "text", placeholder: "https://my-vault.vault.azure.net" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  "aws-secrets-manager": {
    id: "aws-secrets-manager",
    name: "AWS Secrets Manager",
    description: "Sync secrets to AWS Secrets Manager.",
    title: "AWS Secrets Manager mapping",
    providerHeadline: "Store the AWS credentials and region for this connection.",
    targetLabel: "Secret path",
    helper: "Choose the AWS Secrets Manager path, then map each environment type to the correct secret scope.",
    branchLabel: "Branch",
    targetPlaceholder: "/myapp/production",
    branchPlaceholder: "main",
    pathLabel: "Secret prefix",
    pathPlaceholder: "/envsync/",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "access_key_id", label: "Access key ID", kind: "text", placeholder: "AKIAIOSFODNN7EXAMPLE" },
      { key: "secret_access_key", label: "Secret access key", kind: "secret-ref", placeholder: "aws-secret-key" },
      { key: "region", label: "Region", kind: "text", placeholder: "us-east-1" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "secret_path", label: "Secret path", kind: "text", placeholder: "/myapp/production" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  "cloudflare-workers": {
    id: "cloudflare-workers",
    name: "Cloudflare Workers",
    description: "Sync secrets to Cloudflare Workers.",
    title: "Cloudflare Workers secrets mapping",
    providerHeadline: "Store the Cloudflare API token and account context for this connection.",
    targetLabel: "Worker",
    helper: "Choose the Cloudflare Worker, then map each environment type to the correct secrets scope.",
    branchLabel: "Branch",
    targetPlaceholder: "my-worker",
    branchPlaceholder: "main",
    pathLabel: "Secret prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "cf-api-token" },
      { key: "account_id", label: "Account ID", kind: "text", placeholder: "cf-account-id" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "worker_name", label: "Worker name", kind: "text", placeholder: "my-worker" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  "azure-app-service": {
    id: "azure-app-service",
    name: "Azure App Service",
    description: "Sync environment variables to Azure App Service application settings.",
    title: "Azure App Service mapping",
    providerHeadline: "Store the Azure credentials and app context for this connection.",
    targetLabel: "App name",
    helper: "Choose the Azure App Service, then map each environment type to the correct application settings.",
    branchLabel: "Slot",
    targetPlaceholder: "my-app",
    branchPlaceholder: "production",
    pathLabel: "Setting prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "tenant_id", label: "Tenant ID", kind: "text", placeholder: "azure-tenant-id" },
      { key: "client_id", label: "Client ID", kind: "text", placeholder: "azure-client-id" },
      { key: "client_secret", label: "Client secret", kind: "secret-ref", placeholder: "azure-client-secret" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "subscription_id", label: "Subscription ID", kind: "text", placeholder: "azure-subscription-id" },
      { key: "resource_group", label: "Resource group", kind: "text", placeholder: "my-resource-group" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  codefresh: {
    id: "codefresh",
    name: "Codefresh",
    description: "Sync variables to Codefresh pipelines.",
    title: "Codefresh pipeline mapping",
    providerHeadline: "Store the Codefresh API token for this connection.",
    targetLabel: "Project",
    helper: "Choose the Codefresh project, then map each environment type to the correct pipeline variables.",
    branchLabel: "Branch",
    targetPlaceholder: "my-project",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "codefresh-api-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "project_id", label: "Project ID", kind: "text", placeholder: "my-project-id" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  "deno-deploy": {
    id: "deno-deploy",
    name: "Deno Deploy",
    description: "Sync environment variables to Deno Deploy projects.",
    title: "Deno Deploy mapping",
    providerHeadline: "Store the Deno Deploy access token for this connection.",
    targetLabel: "Project",
    helper: "Choose the Deno Deploy project, then map each environment type to the correct environment variables.",
    branchLabel: "Branch",
    targetPlaceholder: "my-project",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "token", label: "Access token", kind: "secret-ref", placeholder: "deno-deploy-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "project_id", label: "Project ID", kind: "text", placeholder: "my-project-id" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  harness: {
    id: "harness",
    name: "Harness",
    description: "Sync secrets to Harness connectors.",
    title: "Harness connector mapping",
    providerHeadline: "Store the Harness API key for this connection.",
    targetLabel: "Connector",
    helper: "Choose the Harness connector, then map each environment type to the correct secrets.",
    branchLabel: "Branch",
    targetPlaceholder: "my-connector",
    branchPlaceholder: "main",
    pathLabel: "Secret prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_key", label: "API key", kind: "secret-ref", placeholder: "harness-api-key" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "connector_id", label: "Connector ID", kind: "text", placeholder: "my-connector-id" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  "hasura-cloud": {
    id: "hasura-cloud",
    name: "Hasura Cloud",
    description: "Sync environment variables to Hasura Cloud projects.",
    title: "Hasura Cloud mapping",
    providerHeadline: "Store the Hasura Cloud API token for this connection.",
    targetLabel: "Project",
    helper: "Choose the Hasura Cloud project, then map each environment type to the correct environment variables.",
    branchLabel: "Branch",
    targetPlaceholder: "my-project",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "hasura-api-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "project_id", label: "Project ID", kind: "text", placeholder: "my-project-id" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  heroku: {
    id: "heroku",
    name: "Heroku",
    description: "Sync config vars to Heroku apps.",
    title: "Heroku config mapping",
    providerHeadline: "Store the Heroku API key for this connection.",
    targetLabel: "App",
    helper: "Choose the Heroku app, then map each environment type to the correct config vars.",
    branchLabel: "Branch",
    targetPlaceholder: "my-app",
    branchPlaceholder: "main",
    pathLabel: "Config prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_key", label: "API key", kind: "secret-ref", placeholder: "heroku-api-key" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "app_name", label: "App name", kind: "text", placeholder: "my-app" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  "laravel-forge": {
    id: "laravel-forge",
    name: "Laravel Forge",
    description: "Sync environment variables to Laravel Forge servers.",
    title: "Laravel Forge mapping",
    providerHeadline: "Store the Laravel Forge API token for this connection.",
    targetLabel: "Server",
    helper: "Choose the Forge server, then map each environment type to the correct environment variables.",
    branchLabel: "Branch",
    targetPlaceholder: "my-server",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "api_token", label: "API token", kind: "secret-ref", placeholder: "forge-api-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "server_id", label: "Server ID", kind: "text", placeholder: "my-server-id" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  qovery: {
    id: "qovery",
    name: "Qovery",
    description: "Sync environment variables to Qovery environments.",
    title: "Qovery environment mapping",
    providerHeadline: "Store the Qovery API token for this connection.",
    targetLabel: "Environment",
    helper: "Choose the Qovery environment, then map each environment type to the correct variables.",
    branchLabel: "Branch",
    targetPlaceholder: "my-environment",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "token", label: "API token", kind: "secret-ref", placeholder: "qovery-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "environment_id", label: "Environment ID", kind: "text", placeholder: "my-environment-id" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
  "terraform-cloud": {
    id: "terraform-cloud",
    name: "Terraform Cloud",
    description: "Sync variables to Terraform Cloud workspaces.",
    title: "Terraform Cloud mapping",
    providerHeadline: "Store the Terraform Cloud API token for this connection.",
    targetLabel: "Workspace",
    helper: "Choose the Terraform Cloud workspace, then map each environment type to the correct variables.",
    branchLabel: "Branch",
    targetPlaceholder: "my-workspace",
    branchPlaceholder: "main",
    pathLabel: "Variable prefix",
    pathPlaceholder: "ENVSYNC_",
    usesBranch: false,
    usesPath: true,
    connectionAuthFields: [
      { key: "token", label: "API token", kind: "secret-ref", placeholder: "tfc-token" },
    ],
    connectionMetadataFields: [
      secretPrefixField,
    ],
    bindingFields: [
      { key: "workspace_id", label: "Workspace ID", kind: "text", placeholder: "my-workspace-id" },
      secretPrefixField,
    ],
    mappingFields: [
      secretPrefixField,
    ],
  },
};

export function emptyFieldValues(fields: ProviderFieldConfig[]) {
  return Object.fromEntries(fields.map((field) => [field.key, ""])) as Record<string, string>;
}

export function extractKnownFieldValues(
  source: Record<string, unknown> | undefined,
  fields: ProviderFieldConfig[],
) {
  return Object.fromEntries(
    fields.map((field) => [field.key, typeof source?.[field.key] === "string" ? String(source[field.key]) : ""]),
  ) as Record<string, string>;
}

export function omitKnownFields(
  source: Record<string, unknown> | undefined,
  fields: ProviderFieldConfig[],
) {
  const clone = { ...(source ?? {}) };
  for (const field of fields) {
    delete clone[field.key];
  }
  return clone;
}

export function mergeFieldValuesIntoRecord(
  fields: ProviderFieldConfig[],
  values: Record<string, string>,
  base: Record<string, unknown> = {},
) {
  const next: Record<string, unknown> = { ...base };
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? "";
    if (value) {
      next[field.key] = value;
    } else {
      delete next[field.key];
    }
  }
  return next;
}
