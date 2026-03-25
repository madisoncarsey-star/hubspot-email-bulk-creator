import { describe, expect, it } from "vitest";
import { extractBodyContent, generatePlainText, inspectHtml } from "@/lib/html";

describe("extractBodyContent", () => {
  it("returns the body markup when a full document is provided", () => {
    const html = "<html><head><title>T</title></head><body><section><p>Hello</p></section></body></html>";
    expect(extractBodyContent(html)).toBe("<section><p>Hello</p></section>");
  });

  it("preserves head style blocks ahead of the extracted body", () => {
    const html = "<html><head><style>.hero{color:red;}</style></head><body><section class=\"hero\"><p>Hello</p></section></body></html>";
    expect(extractBodyContent(html)).toContain("<style>.hero{color:red;}</style>");
  });
});

describe("generatePlainText", () => {
  it("converts HTML into a readable text fallback", () => {
    const html = "<div>Hello<br><strong>World</strong></div><p>Next line</p>";
    expect(generatePlainText(html)).toBe("Hello\nWorld\nNext line");
  });
});

describe("inspectHtml", () => {
  it("warns about malformed tables", () => {
    const inspection = inspectHtml("<html><body><table><tr><td>Hello</td></tr></body></html>");
    expect(inspection.warnings.join(" ")).toContain("Table markup appears unclosed.");
  });
});
