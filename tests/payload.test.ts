import { describe, expect, it } from "vitest";
import { buildEmailPayload } from "@/lib/payload";

describe("buildEmailPayload", () => {
  it("builds a draft-safe marketing email payload", () => {
    const payload = buildEmailPayload({
      filename: "sample.html",
      htmlMarkup: "<p>Hello team</p>",
      internalName: "Sample Internal Name",
      subject: "Sample Subject",
      previewText: "Preview text",
      plainText: "Hello team",
      defaults: {
        uploadDirectory: "marketing-email-uploads",
        fromName: "Marketing",
        replyToEmail: "marketing@example.com",
        folderId: "123",
        campaignId: "campaign-1",
        language: "en",
        baseEmailId: ""
      }
    });

    expect(payload.isPublished).toBe(false);
    expect(payload.sendOnPublish).toBe(false);
    expect(payload.folderIdV2).toBe(123);
    expect(payload.content.widgets["module-rich-text"].body.html).toContain("Hello team");
    expect(payload.content.plainTextVersion).toBe("Hello team");
  });
});
