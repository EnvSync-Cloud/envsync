import { sdk } from "./base";
import { apiKeys } from "./api-keys.api";
import { applications } from "./applications.api";
import { roles } from "./roles.api";
import { users } from "./users.api";
import { webhooks } from "./webhooks.api";
import { gpgKeys } from "./gpg-keys.api";
import { certificates } from "./certificates.api";

export const api = {
  sdk,
  apiKeys,
  applications,
  roles,
  users,
  webhooks,
  gpgKeys,
  certificates,
};

export * from "./base";
