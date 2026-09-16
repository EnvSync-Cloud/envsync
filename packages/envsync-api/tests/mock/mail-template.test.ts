import { describe, expect, test } from "bun:test";

import { renderMailContent } from "@/libs/mail/templates/base";

describe("mail base templates", () => {
	test("loads index/header/body/footer from the source templates directory", async () => {
		const html = await renderMailContent("<p>{{body.msg}}</p>", { msg: "hello-invite" });
		expect(html).toContain("hello-invite");
		expect(html).toContain("<html");
	});
});
