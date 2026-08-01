/**
 * Public surface for the management process package.
 *
 * Callers that import `createManagementApp` must register enterprise modules first:
 *   registerManagementModules(enterpriseManagementModules)
 */
export { createManagementApp } from "./create-app";
export { enterpriseManagementModules } from "envsync-enterprise";
export { registerManagementModules } from "envsync-api/modules";
