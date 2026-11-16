/* src/pages LoggerPage — node-safe SSR smoke + source guard (tokens only in
   page source; no data access). */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LoggerPage } from "../LoggerPage";
import loggerPageSource from "../LoggerPage.tsx?raw";

describe("pages LoggerPage — placeholder surface (plan A5)", () => {
  it("renders the Logger heading and the 'later card' description", () => {
    const html = renderToString(<LoggerPage />).replaceAll("<!-- -->", "");
    expect(html).toContain("<h2");
    expect(html).toContain("Logger");
    expect(html).toContain("arrives in a later card");
  });

  it("page source has no hardcoded colors (tokens come from the atom)", () => {
    expect(loggerPageSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("page source does no data fetching (AGENTS.md data rule)", () => {
    expect(loggerPageSource).not.toMatch(/fetch\s*\(|axios/i);
  });
});
