import { spawnSync } from "node:child_process";
import chalk from "chalk";

import {
	type DeployEdition,
	formatDeploymentPlan,
	loadDeploymentPlanFromFile,
} from "@envsync-cloud/deploy-core";

function printHelp() {
	console.log(`
${chalk.bold("EnvSync OSS Deploy")}

	Commands:
	  bootstrap [--force]               Bootstrap an OSS self-host topology
	  deploy                            Deploy the OSS self-host topology
  remove [--force]                  Remove local OSS deployment resources and files
	  health [--json]                   Inspect OSS self-host health
  org create|status                 Create first org / show setup status (operator token)
  backup                            Create a self-host backup
  validate [deploy.yaml] [--json]   Validate an OSS topology config
  plan [deploy.yaml] [--json]       Render the OSS topology plan
  validate-topology [deploy.yaml]   Alias for validate
  plan-topology [deploy.yaml]       Alias for plan
`);
}

function getPositionals(argv: string[]) {
	return argv.filter(arg => !arg.startsWith("--"));
}

function getPlan(filePath: string | undefined, edition: DeployEdition) {
	return loadDeploymentPlanFromFile(filePath ?? "deploy.yaml", edition);
}

function runLifecycleCommand(args: string[]) {
	const result = spawnSync("bun", ["run", "packages/deploy-cli/src/index.ts", ...args], {
		cwd: process.cwd(),
		stdio: "inherit",
		env: process.env,
	});
	if ((result.status ?? 1) !== 0) {
		process.exit(result.status ?? 1);
	}
}

async function main() {
	const argv = process.argv.slice(2);
	const command = argv[0];
	const rest = argv.slice(1);
	const json = rest.includes("--json");
	const positionals = getPositionals(rest);
	const filePath = positionals[0];

	if (!command || command === "--help" || command === "help") {
		printHelp();
		return;
	}

	switch (command) {
		case "bootstrap":
		case "deploy":
		case "remove":
		case "health":
		case "backup":
		case "restore":
		case "promote":
		case "rollback":
		case "upgrade":
		case "upgrade-deps":
		case "org": {
			// Phase 1b: org create/status via setup token (still delegates until Phase 3 OSS lifecycle split)
			runLifecycleCommand([command, ...rest]);
			break;
		}
		case "validate": {
			const plan = getPlan(filePath, "oss");
			if (json) {
				console.log(JSON.stringify({ valid: true, edition: plan.edition, warnings: plan.warnings }, null, 2));
			} else {
				console.log(chalk.green("OSS topology is valid."));
				if (plan.warnings.length > 0) {
					for (const warning of plan.warnings) {
						console.log(chalk.yellow(`warning: ${warning}`));
					}
				}
			}
			break;
		}
		case "plan": {
			const plan = getPlan(filePath, "oss");
			console.log(formatDeploymentPlan(plan, json ? "json" : "yaml"));
			break;
		}
		case "validate-topology": {
			const plan = getPlan(filePath, "oss");
			if (json) {
				console.log(JSON.stringify({ valid: true, edition: plan.edition, warnings: plan.warnings }, null, 2));
			} else {
				console.log(chalk.green("OSS topology is valid."));
			}
			break;
		}
		case "plan-topology": {
			const plan = getPlan(filePath, "oss");
			console.log(formatDeploymentPlan(plan, json ? "json" : "yaml"));
			break;
		}
		default:
			throw new Error(`Unknown command: ${command}`);
	}
}

main().catch(error => {
	console.error(chalk.red(error instanceof Error ? error.message : String(error)));
	process.exit(1);
});
