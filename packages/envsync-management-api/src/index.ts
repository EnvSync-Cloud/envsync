/**
 * Library export for the management process.
 * Prefer running `src/entrypoint.ts` as the server.
 *
 * Callers that import `app` must register enterprise modules first:
 *   registerManagementModules(enterpriseManagementModules)
 */
export { createManagementApp as createApp } from "envsync-api/create-management-app";
export { enterpriseManagementModules } from "envsync-enterprise";
export { registerManagementModules } from "envsync-api/modules";
