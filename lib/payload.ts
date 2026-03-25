import type { HubSpotEmailPayloadInput } from "@/lib/types";

function maybeNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildContent(htmlMarkup: string, previewText: string, plainText: string) {
  return {
    type: "EMAIL",
    templatePath: "@hubspot/email/dnd/plain_text.html",
    plainTextVersion: plainText,
    styleSettings: {},
    flexAreas: {
      main: {
        boxed: false,
        isSingleColumnFullWidth: true,
        sections: [
          {
            id: "section-main",
            columns: [
              {
                id: "column-main",
                width: 12,
                widgets: ["module-rich-text"]
              }
            ],
            style: {
              backgroundType: "CONTENT",
              paddingTop: "0px",
              paddingBottom: "0px"
            }
          }
        ]
      }
    },
    widgets: {
      preview_text: {
        type: "text",
        id: "preview_text",
        name: "preview_text",
        order: 0,
        body: {
          value: previewText
        }
      },
      "module-rich-text": {
        type: "module",
        id: "module-rich-text",
        name: "module-rich-text",
        order: 1,
        module_id: 1155639,
        body: {
          path: "@hubspot/rich_text",
          schema_version: 2,
          css_class: "dnd-module",
          html: htmlMarkup
        },
        styles: {},
        css: {},
        child_css: {}
      }
    }
  };
}

export function buildEmailPayload(input: HubSpotEmailPayloadInput) {
  return {
    name: input.internalName,
    subject: input.subject,
    language: input.defaults.language || "en",
    isPublished: false,
    archived: false,
    sendOnPublish: false,
    from: {
      fromName: input.defaults.fromName || undefined,
      replyTo: input.defaults.replyToEmail || undefined
    },
    folderId: maybeNumber(input.defaults.folderId),
    campaign: input.defaults.campaignId || undefined,
    content: buildContent(input.htmlMarkup, input.previewText, input.plainText)
  };
}

export function buildPatchPayload(payload: ReturnType<typeof buildEmailPayload>) {
  return {
    name: payload.name,
    subject: payload.subject,
    language: payload.language,
    from: payload.from,
    folderId: payload.folderId,
    campaign: payload.campaign,
    sendOnPublish: false,
    content: payload.content
  };
}
