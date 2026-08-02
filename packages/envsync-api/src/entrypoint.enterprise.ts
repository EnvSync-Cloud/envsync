/**
 * Enterprise self-host / Hosted API entry: register manage modules before the
 * core process boots so /api/v1/manage/{module}/... is mounted.
 *
 * Bundled by docker/api-enterprise.Dockerfile (includes envsync-enterprise).
 * OSS image uses entrypoint.ts only and never pulls proprietary modules.
 *
 * Relative import keeps package.json free of envsync-enterprise (no Turbo cycle).
 */
import { enterpriseManagementModules } from "../../envsync-enterprise/src/index.ts";
import { registerManagementModules } from "@/modules/load-modules";

registerManagementModules(enterpriseManagementModules);

await import("./entrypoint");
