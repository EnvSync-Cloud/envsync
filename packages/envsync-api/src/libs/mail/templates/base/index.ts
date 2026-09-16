import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Mustache from "mustache";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR_CANDIDATES = [
	here,
	path.join(here, "templates", "base"),
	path.join(here, "..", "templates", "base"),
	path.join(here, "..", "..", "templates", "base"),
];

async function readBasePart(fileName: string): Promise<string> {
	for (const dir of BASE_DIR_CANDIDATES) {
		try {
			return await fs.readFile(path.join(dir, `${fileName}.html`), "utf8");
		} catch {
			// try next candidate
		}
	}
	throw new Error(`Failed to resolve mail base template ${fileName}.html`);
}

const getMailTemplate = async (): Promise<string> => {
	const [indexHTML, headerHTML, bodyHTML, footerHTML] = await Promise.all(
		["index", "header", "body", "footer"].map(fileName => readBasePart(fileName)),
	);
	return await Mustache.render(indexHTML, {
		header: headerHTML,
		body: bodyHTML,
		footer: footerHTML,
	});
};

export const renderMailContent = async (contentTemplate: string, body: unknown) => {
	const mainHTML = await getMailTemplate();
	const contentHTML = await Mustache.render(contentTemplate, { body });
	return await Mustache.render(mainHTML, {
		content: contentHTML,
	});
};
