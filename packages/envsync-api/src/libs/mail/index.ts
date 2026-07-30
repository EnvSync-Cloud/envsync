import fs from "node:fs/promises";
import path from "node:path";

import infoLogs, { LogTypes } from "@/libs/logger";

import { sendMail } from "./config";
import { renderMailContent } from "./templates/base";
import { config } from "@/utils/env";

const __dirname = new URL(".", import.meta.url).pathname;

const FROM_EMAIL = config.SMTP_FROM;

const readTemplate = async (templateName: string) => {
	const templateCandidates = [
		path.join(__dirname, "templates", "html", templateName),
		path.join(__dirname, "..", "templates", "html", templateName),
		path.join(__dirname, "..", "..", "templates", "html", templateName),
	];

	for (const candidate of templateCandidates) {
		try {
			return await fs.readFile(candidate, "utf8");
		} catch {}
	}

	throw new Error(`Failed to resolve mail template ${templateName}`);
};

export const onOrgOnboardingInvite = async (
	email: string,
	body: {
		accept_link: string;
	},
) => {
	const contentTemplate = await readTemplate("org-onboarding-invite.html");
	const html = await renderMailContent(contentTemplate, body);
	const subject = "EnvSync Org Onboarding Invite";
	const mail = {
		from: FROM_EMAIL,
		to: email,
		subject,
		text: subject,
		html,
	};
	try {
		await sendMail(mail);
		infoLogs(`Email sent to ${email}`, LogTypes.LOGS, "MAIL:INVITE");
	} catch (err) {
		infoLogs(
			`Error sending email to ${email}: ${(err as Error)?.message || err}`,
			LogTypes.ERROR,
			"MAIL:INVITE",
		);
		throw new Error(`Failed to send invitation email to ${email}`);
	}
};

export const onUserOnboardingInvite = async (
	email: string,
	body: {
		accept_link: string;
		org_name: string;
	},
) => {
	const contentTemplate = await readTemplate("user-onboarding-invite.html");
	const html = await renderMailContent(contentTemplate, body);
	const subject = "EnvSync User Onboarding Invite";
	const mail = {
		from: FROM_EMAIL,
		to: email,
		subject,
		text: subject,
		html,
	};
	try {
		await sendMail(mail);
		infoLogs(`Email sent to ${email}`, LogTypes.LOGS, "MAIL:INVITE");
	} catch (err) {
		infoLogs(
			`Error sending email to ${email}: ${(err as Error)?.message || err}`,
			LogTypes.ERROR,
			"MAIL:INVITE",
		);
		throw new Error(`Failed to send invitation email to ${email}`);
	}
};
