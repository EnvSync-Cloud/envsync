/**
 * EE migrate entry: register manage modules so FileMigrationProvider also
 * sees enterprise migration directories, then run the core migrate CLI.
 */
import { enterpriseManagementModules } from "../../envsync-enterprise/src/index.ts";
import { registerManagementModules } from "../src/modules/load-modules";

registerManagementModules(enterpriseManagementModules);

await import("./migrate.ts");
