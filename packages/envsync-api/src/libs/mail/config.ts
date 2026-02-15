import nodemailer from "nodemailer";

import { config } from "@/utils/env";

const transporter = nodemailer.createTransport({
	host: config.SMTP_HOST,
	port: Number(config.SMTP_PORT),
	secure: config.SMTP_SECURE === "true",
	auth:
		config.SMTP_USER && config.SMTP_PASS
			? { user: config.SMTP_USER, pass: config.SMTP_PASS }
			: undefined,
});

export const sendMail = ({
	from,
	to,
	subject,
	text,
	html,
}: {
	from: string;
	to: string;
	subject: string;
	text: string;
	html: string;
}) => transporter.sendMail({ from, to, subject, text, html });
