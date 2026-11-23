import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.js";

import HomeLanding from "./HomeLanding";

test("routes both homepage signup links to hosted onboarding", () => {
  const html = renderToStaticMarkup(
    <StaticRouter location="/">
      <HomeLanding />
    </StaticRouter>,
  );
  const signupLinks = Array.from(html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>Start for free<\/a>/g));
  expect(signupLinks.map((link) => link[1])).toEqual(["/onboarding", "/onboarding"]);
  expect(html).toContain("Zero trust access layer for secrets");
});
