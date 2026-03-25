import { describe, expect, it } from "vitest";
import { parseMetadataCsv } from "@/lib/csv";

describe("parseMetadataCsv", () => {
  it("parses supported metadata columns", () => {
    const csv = [
      "filename,subject,preview_text,internal_name",
      "welcome.html,Welcome to our spring launch,Read this first,Spring Welcome"
    ].join("\n");

    expect(parseMetadataCsv(csv)).toEqual([
      {
        filename: "welcome.html",
        subject: "Welcome to our spring launch",
        preview_text: "Read this first",
        internal_name: "Spring Welcome"
      }
    ]);
  });

  it("throws when filename column is missing", () => {
    expect(() => parseMetadataCsv("subject\nHello")).toThrow("filename column");
  });
});
