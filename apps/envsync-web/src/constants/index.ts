import {
  Database,
  Users,
  Key,
  Activity,
  Settings,
  Globe,
  ShieldAlert,
  Anchor
} from "lucide-react";
import type { FC } from "react";

export enum API_KEYS {
  ALL_API_KEYS = "api-keys",
  ALL_WEBHOOKS = "webhooks",
  ALL_APPLICATIONS = "applications/all",
  ALL_USERS = "users/all",
  ALL_ROLES = "roles/all",
  ALL_ENVIRONMENTS = "environments/all",
  ALL_ORGANIZATIONS = "organizations/all",
  ALL_AUDIT_LOGS = "audit-logs/all",
  ALL_ENVIRONMENT_TYPES = "environment-types/all",
  ALL_ENVIRONMENT_VARIABLES = "environment-variables/all",
  ALL_PITCHANGES = "pit-changes/all",
}

export const SCOPES = [
  "applications",
  "users",
  "roles",
  "apikeys",
  "webhooks",
  "audit",
  "settings",
  "organisation",
] as const;

export const navItems = [
  { id: "applications", name: "Projects", icon: Database },
  { id: "users", name: "Team", icon: Users },
  { id: "roles", name: "Roles", icon: ShieldAlert },
  { id: "apikeys", name: "API Keys", icon: Key },
  { id: "webhooks", name: "Webhooks", icon: Anchor },
  { id: "audit", name: "Activity", icon: Activity },
  { id: "settings", name: "Account", icon: Settings },
  { id: "organisation", name: "Organisation", icon: Globe },
] satisfies {
  id: (typeof SCOPES)[number];
  name: string;
  icon: FC;
}[];

export interface FormData {
  name: string;
  contact_email: string;
  website: string;
  logo_url: string | null;
}

export interface FormErrors {
  name?: string;
  contact_email?: string;
  website?: string;
  logo_url?: string;
}

export const INITIAL_FORM_DATA: FormData = {
  name: "",
  contact_email: "",
  website: "",
  logo_url: null,
};

export const INITIAL_FORM_ERRORS: FormErrors = {};

// File upload constraints
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Validation rules
export const MIN_ORG_NAME_LENGTH = 2;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface App {
  id: string;
  org_id: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  status?: string;
  created_at: Date;
  updated_at: Date;
  env_count?: number;
  secret_count?: number;
  is_managed_secret?: boolean;
  public_key?: string;
  enable_secrets?: boolean;
}

export interface FilterOptions {
  status: string;
  sortBy: "name" | "created_at" | "updated_at";
  sortOrder: "asc" | "desc";
}

export interface Statistics {
  total: number;
  active: number;
  inactive: number;
  filtered: number;
}

// Constants
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  status: "all",
  sortBy: "updated_at",
  sortOrder: "desc",
};

export const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Last Updated" },
] as const;

export const DEBOUNCE_DELAY = 300;

// Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EnvironmentType {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  is_protected: boolean;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  sensitive: boolean;
  env_type_id: string;
  created_at: Date;
  updated_at: Date;
  app_id: string;
}

export interface EnvVarFormData {
  key: string;
  value: string;
  sensitive: boolean;
  env_type_id: string;
}

export interface EnvVarFormErrors {
  key?: string;
  value?: string;
  env_type_id?: string;
}

export interface BulkEnvVarData {
  env_type_id: string;
  variables: Array<{
    key: string;
    value: string;
    sensitive: boolean;
  }>;
}

// Constants
export const MAX_KEY_LENGTH = 255;
export const MAX_VALUE_LENGTH = 10000;
export const ENV_VAR_KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;

export const INITIAL_ENV_VAR_FORM: EnvVarFormData = {
  key: "",
  value: "",
  sensitive: false,
  env_type_id: "",
};

export const INITIAL_ENV_FORM_ERRORS: EnvVarFormErrors = {};

export const BULK_IMPORT_EXAMPLE = `# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=myapp

# API Configuration
API_KEY=your-secret-api-key-here
API_URL=https://api.example.com
API_TIMEOUT=30000

# Application Settings
DEBUG=true
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Third-party Services
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
SENDGRID_API_KEY=SG.your_sendgrid_api_key
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key
SESSION_SECRET=your-session-secret`;

// Environment variable categories for better organization
export const ENV_VAR_CATEGORIES = {
  DATABASE: ["DATABASE", "DB", "POSTGRES", "MYSQL", "MONGO", "REDIS"],
  API: ["API", "ENDPOINT", "URL", "URI"],
  AUTH: ["AUTH", "JWT", "TOKEN", "SECRET", "KEY", "PASSWORD", "CREDENTIAL"],
  CONFIG: ["CONFIG", "SETTING", "OPTION", "FLAG"],
  SERVICE: ["SERVICE", "EXTERNAL", "THIRD_PARTY"],
} as const;

// Sensitive keywords that automatically mark variables as secrets
export const SENSITIVE_KEYWORDS = [
  "SECRET",
  "PASSWORD",
  "TOKEN",
  "KEY",
  "AUTH",
  "CREDENTIAL",
  "PRIVATE",
  "JWT",
  "API_KEY",
  "STRIPE",
  "PAYPAL",
  "OAUTH",
] as const;

// Color palette for environment types
export const ENV_TYPE_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#f472b6", // rose
  "#ec4899", // pink
] as const;

export const WEBHOOK_EVENT_CATEGORIES = [
  {
    name: "roles",
    label: "Roles & Permissions",
    subcategories: [
      {
        name: "role_operations",
        label: "Role Operations",
        events: [
          { value: "roles_viewed", label: "Roles Viewed" },
          { value: "role_viewed", label: "Role Viewed" },
          { value: "role_created", label: "Role Created" },
          { value: "role_updated", label: "Role Updated" },
          { value: "role_deleted", label: "Role Deleted" }
        ]
      }
    ],
    events: [
      { value: "roles_viewed", label: "Roles Viewed" },
      { value: "role_viewed", label: "Role Viewed" },
      { value: "role_created", label: "Role Created" },
      { value: "role_updated", label: "Role Updated" },
      { value: "role_deleted", label: "Role Deleted" }
    ]
  },
  {
    name: "applications",
    label: "Applications",
    subcategories: [
      {
        name: "app_operations",
        label: "App Operations",
        events: [
          { value: "app_created", label: "App Created" },
          { value: "app_updated", label: "App Updated" },
          { value: "app_viewed", label: "App Viewed" },
          { value: "apps_viewed", label: "Apps Viewed" },
          { value: "app_deleted", label: "App Deleted" }
        ]
      }
    ],
    events: [
      { value: "app_created", label: "App Created" },
      { value: "app_updated", label: "App Updated" },
      { value: "app_viewed", label: "App Viewed" },
      { value: "apps_viewed", label: "Apps Viewed" },
      { value: "app_deleted", label: "App Deleted" }
    ]
  },
  {
    name: "organization",
    label: "Organization",
    subcategories: [
      {
        name: "org_operations",
        label: "Organization Operations",
        events: [
          { value: "org_created", label: "Organization Created" },
          { value: "org_updated", label: "Organization Updated" }
        ]
      }
    ],
    events: [
      { value: "org_created", label: "Organization Created" },
      { value: "org_updated", label: "Organization Updated" }
    ]
  },
  {
    name: "users",
    label: "Users & Invites",
    subcategories: [
      {
        name: "user_operations",
        label: "User Operations",
        events: [
          { value: "user_deleted", label: "User Deleted" },
          { value: "user_retrieved", label: "User Retrieved" },
          { value: "users_retrieved", label: "Users Retrieved" },
          { value: "user_role_updated", label: "User Role Updated" },
          { value: "user_updated", label: "User Updated" }
        ]
      },
      {
        name: "user_invites",
        label: "User Invites",
        events: [
          { value: "user_invite_accepted", label: "User Invite Accepted" },
          { value: "user_invite_created", label: "User Invite Created" },
          { value: "user_invite_deleted", label: "User Invite Deleted" },
          { value: "user_invite_updated", label: "User Invite Updated" },
          { value: "user_invite_viewed", label: "User Invite Viewed" }
        ]
      }
    ],
    events: [
      { value: "user_deleted", label: "User Deleted" },
      { value: "user_invite_accepted", label: "User Invite Accepted" },
      { value: "user_invite_created", label: "User Invite Created" },
      { value: "user_invite_deleted", label: "User Invite Deleted" },
      { value: "user_invite_updated", label: "User Invite Updated" },
      { value: "user_invite_viewed", label: "User Invite Viewed" },
      { value: "user_retrieved", label: "User Retrieved" },
      { value: "users_retrieved", label: "Users Retrieved" },
      { value: "user_role_updated", label: "User Role Updated" },
      { value: "user_updated", label: "User Updated" }
    ]
  },
  {
    name: "environment",
    label: "Environment Variables",
    subcategories: [
      {
        name: "env_operations",
        label: "Environment Operations",
        events: [
          { value: "env_created", label: "Environment Created" },
          { value: "env_updated", label: "Environment Updated" },
          { value: "env_deleted", label: "Environment Deleted" },
          { value: "env_viewed", label: "Environment Viewed" },
          { value: "envs_viewed", label: "Environments Viewed" }
        ]
      },
      {
        name: "env_batch",
        label: "Batch Operations",
        events: [
          { value: "envs_batch_updated", label: "Environments Batch Updated" },
          { value: "envs_batch_created", label: "Environments Batch Created" },
          { value: "envs_batch_deleted", label: "Environments Batch Deleted" }
        ]
      },
      {
        name: "env_rollback",
        label: "Rollback Operations",
        events: [
          { value: "envs_rollback_pit", label: "Environments Rollback PIT" },
          { value: "envs_rollback_timestamp", label: "Environments Rollback Timestamp" },
          { value: "env_variable_rollback_pit", label: "Environment Variable Rollback PIT" },
          { value: "env_variable_rollback_timestamp", label: "Environment Variable Rollback Timestamp" }
        ]
      }
    ],
    events: [
      { value: "env_created", label: "Environment Created" },
      { value: "env_updated", label: "Environment Updated" },
      { value: "env_deleted", label: "Environment Deleted" },
      { value: "env_viewed", label: "Environment Viewed" },
      { value: "envs_viewed", label: "Environments Viewed" },
      { value: "envs_batch_updated", label: "Environments Batch Updated" },
      { value: "envs_batch_created", label: "Environments Batch Created" },
      { value: "envs_batch_deleted", label: "Environments Batch Deleted" },
      { value: "envs_rollback_pit", label: "Environments Rollback PIT" },
      { value: "envs_rollback_timestamp", label: "Environments Rollback Timestamp" },
      { value: "env_variable_rollback_pit", label: "Environment Variable Rollback PIT" },
      { value: "env_variable_rollback_timestamp", label: "Environment Variable Rollback Timestamp" }
    ]
  },
  {
    name: "secrets",
    label: "Secrets Management",
    subcategories: [
      {
        name: "secret_operations",
        label: "Secret Operations",
        events: [
          { value: "secret_created", label: "Secret Created" },
          { value: "secret_updated", label: "Secret Updated" },
          { value: "secret_deleted", label: "Secret Deleted" },
          { value: "secret_viewed", label: "Secret Viewed" },
          { value: "secrets_viewed", label: "Secrets Viewed" }
        ]
      },
      {
        name: "secret_batch",
        label: "Batch Operations",
        events: [
          { value: "secrets_batch_updated", label: "Secrets Batch Updated" },
          { value: "secrets_batch_created", label: "Secrets Batch Created" },
          { value: "secrets_batch_deleted", label: "Secrets Batch Deleted" }
        ]
      },
      {
        name: "secret_rollback",
        label: "Rollback Operations",
        events: [
          { value: "secrets_rollback_pit", label: "Secrets Rollback PIT" },
          { value: "secrets_rollback_timestamp", label: "Secrets Rollback Timestamp" },
          { value: "secret_variable_rollback_pit", label: "Secret Variable Rollback PIT" },
          { value: "secret_variable_rollback_timestamp", label: "Secret Variable Rollback Timestamp" }
        ]
      }
    ],
    events: [
      { value: "secret_created", label: "Secret Created" },
      { value: "secret_updated", label: "Secret Updated" },
      { value: "secret_deleted", label: "Secret Deleted" },
      { value: "secret_viewed", label: "Secret Viewed" },
      { value: "secrets_viewed", label: "Secrets Viewed" },
      { value: "secrets_batch_updated", label: "Secrets Batch Updated" },
      { value: "secrets_batch_created", label: "Secrets Batch Created" },
      { value: "secrets_batch_deleted", label: "Secrets Batch Deleted" },
      { value: "secrets_rollback_pit", label: "Secrets Rollback PIT" },
      { value: "secrets_rollback_timestamp", label: "Secrets Rollback Timestamp" },
      { value: "secret_variable_rollback_pit", label: "Secret Variable Rollback PIT" },
      { value: "secret_variable_rollback_timestamp", label: "Secret Variable Rollback Timestamp" }
    ]
  },
  {
    name: "env_types",
    label: "Environment Types",
    subcategories: [
      {
        name: "env_type_operations",
        label: "Environment Type Operations",
        events: [
          { value: "env_type_viewed", label: "Environment Type Viewed" },
          { value: "env_types_viewed", label: "Environment Types Viewed" },
          { value: "env_type_created", label: "Environment Type Created" },
          { value: "env_type_updated", label: "Environment Type Updated" },
          { value: "env_type_deleted", label: "Environment Type Deleted" }
        ]
      }
    ],
    events: [
      { value: "env_type_viewed", label: "Environment Type Viewed" },
      { value: "env_types_viewed", label: "Environment Types Viewed" },
      { value: "env_type_created", label: "Environment Type Created" },
      { value: "env_type_updated", label: "Environment Type Updated" },
      { value: "env_type_deleted", label: "Environment Type Deleted" }
    ]
  },
  {
    name: "api_keys",
    label: "API Keys",
    subcategories: [
      {
        name: "apikey_operations",
        label: "API Key Operations",
        events: [
          { value: "apikey_created", label: "API Key Created" },
          { value: "apikey_updated", label: "API Key Updated" },
          { value: "apikey_deleted", label: "API Key Deleted" },
          { value: "apikey_viewed", label: "API Key Viewed" },
          { value: "apikeys_viewed", label: "API Keys Viewed" },
          { value: "apikey_regenerated", label: "API Key Regenerated" }
        ]
      }
    ],
    events: [
      { value: "apikey_created", label: "API Key Created" },
      { value: "apikey_updated", label: "API Key Updated" },
      { value: "apikey_deleted", label: "API Key Deleted" },
      { value: "apikey_viewed", label: "API Key Viewed" },
      { value: "apikeys_viewed", label: "API Keys Viewed" },
      { value: "apikey_regenerated", label: "API Key Regenerated" }
    ]
  },
  {
    name: "audit",
    label: "Audit & Monitoring",
    subcategories: [
      {
        name: "audit_operations",
        label: "Audit Operations",
        events: [
          { value: "get_audit_logs", label: "Get Audit Logs" }
        ]
      }
    ],
    events: [
      { value: "get_audit_logs", label: "Get Audit Logs" }
    ]
  }
];
