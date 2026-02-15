import fs from "node:fs/promises";

import Mustache from "mustache";

const getMailTemplate = async (): Promise<string> => {
	const htmlFiles = ["index", "header", "body", "footer"];
	const [indexHTML, headerHTML, bodyHTML, footerHTML] = await Promise.all(
		htmlFiles.map(fileName => fs.readFile(`${__dirname}/${fileName}.html`, "utf8")),
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
