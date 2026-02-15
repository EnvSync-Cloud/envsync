import fs from "node:fs/promises";

import infoLogs, { LogTypes } from "@/libs/logger";

import { sendMail } from "./config";
import { renderMailContent } from "./templates/base";
import { config } from "@/utils/env";

const __dirname = new URL(".", import.meta.url).pathname;

const FROM_EMAIL = config.SMTP_FROM;

export const onOrgOnboardingInvite = async (
	email: string,
	body: {
		accept_link: string;
	},
) => {
	const contentTemplate = await fs.readFile(
		`${__dirname}/templates/html/org-onboarding-invite.html`,
		"utf8",
	);
	const html = await renderMailContent(contentTemplate, body);
	const subject = "EnvSync Org Onboarding Invite";
	const mail = {
		from: FROM_EMAIL,
		to: email,
		subject,
		text: subject,
		html,
	};
	sendMail(mail)
		.then(() => {
			infoLogs(`Email sent to ${email}`, LogTypes.LOGS, "MAIL:INVITE");
		})
		.catch(() => {
			infoLogs(`Error sending email to ${email}`, LogTypes.ERROR, "MAIL:INVITE");
		});
};

export const onUserOnboardingInvite = async (
	email: string,
	body: {
		accept_link: string;
		org_name: string;
	},
) => {
	const contentTemplate = await fs.readFile(
		`${__dirname}/templates/html/user-onboarding-invite.html`,
		"utf8",
	);
	const html = await renderMailContent(contentTemplate, body);
	const subject = "EnvSync User Onboarding Invite";
	const mail = {
		from: FROM_EMAIL,
		to: email,
		subject,
		text: subject,
		html,
	};
	sendMail(mail)
		.then(() => {
			infoLogs(`Email sent to ${email}`, LogTypes.LOGS, "MAIL:INVITE");
		})
		.catch(() => {
			infoLogs(`Error sending email to ${email}`, LogTypes.ERROR, "MAIL:INVITE");
		});
};
