import type { HubSpotEmailPayloadInput } from "@/lib/types";

function maybeNumber(value: string) {
  const normalized = value || "";
  if (!normalized.trim()) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildFrom(defaults: HubSpotEmailPayloadInput["defaults"]) {
  const fromName = defaults.fromName || "";
  const replyToEmail = defaults.replyToEmail || "";

  if (!fromName.trim() && !replyToEmail.trim()) {
    return undefined;
  }

  return {
    fromName: fromName || undefined,
    replyTo: replyToEmail || undefined
  };
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
        isSingleColumnFullWidth: false,
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
              paddingTop: "24px",
              paddingBottom: "24px"
            }
          },
          {
            id: "section-footer",
            columns: [
              {
                id: "column-footer",
                width: 12,
                widgets: ["module-email-footer"]
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
      },
      "module-email-footer": {
        type: "module",
        id: "module-email-footer",
        name: "module-email-footer",
        order: 2,
        module_id: 2869621,
        body: {
          align: "center",
          css_class: "dnd-module",
          path: "@hubspot/email_footer",
          schema_version: 2,
          unsubscribe_link_type: "both"
        },
        styles: {},
        css: {},
        child_css: {}
      }
    }
  };
}

export function buildEmailPayload(input: HubSpotEmailPayloadInput) {
  const from = buildFrom(input.defaults);

  return {
    name: input.internalName,
    subject: input.subject,
    language: input.defaults.language || "en",
    isPublished: false,
    archived: false,
    sendOnPublish: false,
    from,
    folderIdV2: maybeNumber(input.defaults.folderId),
    campaign: input.defaults.campaignId || undefined,
    content: buildContent(input.htmlMarkup, input.previewText, input.plainText)
  };
}

export function buildCreateSeedPayload(input: HubSpotEmailPayloadInput) {
  const from = buildFrom(input.defaults);

  return {
    name: input.internalName,
    subject: input.subject,
    language: input.defaults.language || "en",
    templatePath: "@hubspot/email/dnd/plain_text.html",
    from,
    folderIdV2: maybeNumber(input.defaults.folderId),
    campaign: input.defaults.campaignId || undefined
  };
}

export function buildPatchPayload(
  payload: ReturnType<typeof buildEmailPayload>,
  options?: {
    activeDomain?: string;
    officeLocationId?: string;
  }
) {
  return {
    activeDomain: options?.activeDomain,
    name: payload.name,
    subject: payload.subject,
    language: payload.language,
    from: payload.from,
    folderIdV2: payload.folderIdV2,
    campaign: payload.campaign,
    sendOnPublish: false,
    subscriptionDetails: options?.officeLocationId
      ? {
          officeLocationId: options.officeLocationId
        }
      : undefined,
    content: payload.content
  };
}
