import { sdk } from "./base";
import { apiKeys } from "./api-keys.api";
import { applications } from "./applications.api";
import { roles } from "./roles.api";
import { users } from "./users.api";
import { webhooks } from "./webhooks.api";
import { gpgKeys } from "./gpg-keys.api";
import { certificates } from "./certificates.api";
import { teams } from "./teams.api";
import { permissions } from "./permissions.api";
import { changeRequests } from "./change-requests.api";
import { serviceTokens } from "./service-tokens.api";

export const api = {
  sdk,
  apiKeys,
  applications,
  roles,
  users,
  webhooks,
  gpgKeys,
  certificates,
  teams,
  permissions,
  changeRequests,
  serviceTokens,
};

export * from "./base";
