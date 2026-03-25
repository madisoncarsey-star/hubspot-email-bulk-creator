import { NextResponse } from "next/server";
import { buildCreateSeedPayload, buildEmailPayload, buildPatchPayload } from "@/lib/payload";
import { createDraftEmail, cloneDraftEmail, patchDraftEmail } from "@/lib/hubspot";
import { envConfig, resolveToken } from "@/lib/config";
import { parseMetadataCsv } from "@/lib/csv";
import { generatePlainText, inspectHtml, sanitizeFilename } from "@/lib/html";
import { sleep } from "@/lib/retry";
import type {
  ApiResult,
  BulkCreateRequest,
  CsvMetadataRow,
  HtmlInspection,
  UploadFileRecord
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

function normalizeUploadLimit(runMode: string, files: UploadFileRecord[]) {
  if (runMode === "test-1") return files.slice(0, 1);
  if (runMode === "test-2") return files.slice(0, 2);
  return files;
}

function metadataMap(rows: CsvMetadataRow[]) {
  return new Map(rows.map((row) => [row.filename.toLowerCase(), row]));
}

function createInternalName(filename: string, row?: CsvMetadataRow) {
  return row?.internal_name?.trim() || filename.replace(/\.html$/i, "").replace(/[_-]+/g, " ").trim();
}

function createSubject(filename: string, row?: CsvMetadataRow) {
  return row?.subject?.trim() || filename.replace(/\.html$/i, "").replace(/[_-]+/g, " ").trim();
}

function createPreviewText(row?: CsvMetadataRow) {
  return row?.preview_text?.trim() || "";
}

function createWarnings(inspection: HtmlInspection) {
  const warnings = [...inspection.warnings];
  if (!inspection.bodyMarkup.trim()) warnings.push("No usable body markup detected.");
  return warnings;
}

function validateRequestDefaults(request: BulkCreateRequest) {
  const warnings: string[] = [];
  if (request.defaults.replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.defaults.replyToEmail)) {
    warnings.push("Reply-to email format looks invalid.");
  }
  return warnings;
}

async function formFileToRecord(file: File): Promise<UploadFileRecord> {
  const content = (await file.text()).replace(/\0/g, "").replace(/\r\n/g, "\n");

  return {
    filename: sanitizeFilename(file.name),
    originalFilename: file.name,
    content,
    size: file.size
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const htmlFiles = formData.getAll("htmlFiles").filter((item): item is File => item instanceof File);
  const metadataCsv = formData.get("metadataCsv");
  const privateToken = String(formData.get("privateToken") || "");
  const executionMode = String(formData.get("executionMode") || "dry-run");
  const runMode = String(formData.get("runMode") || "test-2");

  if (htmlFiles.length === 0) {
    return badRequest("At least one HTML file is required.");
  }

  const uploadRecords = normalizeUploadLimit(
    runMode,
    await Promise.all(htmlFiles.map((file) => formFileToRecord(file)))
  );

  if (uploadRecords.some((file) => !file.filename.toLowerCase().endsWith(".html"))) {
    return badRequest("Every uploaded file must end with .html.");
  }

  let csvRows: CsvMetadataRow[] = [];
  try {
    csvRows =
      metadataCsv instanceof File && metadataCsv.size > 0 ? parseMetadataCsv(await metadataCsv.text()) : [];
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to parse metadata CSV.");
  }
  const metadataByFilename = metadataMap(csvRows);

  const bulkRequest: BulkCreateRequest = {
    executionMode: executionMode === "create" ? "create" : "dry-run",
    runMode: runMode === "test-1" || runMode === "test-2" || runMode === "all" ? runMode : "test-2",
    defaults: {
      fromName: String(formData.get("fromName") || "").trim() || envConfig.defaultFromName,
      replyToEmail: String(formData.get("replyToEmail") || "").trim() || envConfig.defaultReplyToEmail,
      folderId: String(formData.get("folderId") || "").trim() || envConfig.defaultFolderId,
      campaignId: String(formData.get("campaignId") || "").trim() || envConfig.defaultCampaignId,
      language: String(formData.get("language") || "").trim() || envConfig.defaultLanguage,
      baseEmailId: String(formData.get("baseEmailId") || "").trim()
    }
  };

  const results: ApiResult[] = [];
  const requestWarnings = validateRequestDefaults(bulkRequest);

  let token = "";
  if (bulkRequest.executionMode === "create") {
    token = resolveToken(privateToken);
    if (!token) {
      return badRequest("HubSpot private app token is required for create mode.");
    }
  }

  for (const file of uploadRecords) {
    const csvRow = metadataByFilename.get(file.filename.toLowerCase());
    const inspection = inspectHtml(file.content);
    const warnings = [...requestWarnings, ...createWarnings(inspection)];
    const internalName = createInternalName(file.filename, csvRow);
    const subject = createSubject(file.filename, csvRow);
    const plainText = generatePlainText(inspection.bodyMarkup || file.content);
    const previewText = createPreviewText(csvRow);

    if (!inspection.isProbablyHtml) {
      results.push({
        filename: file.filename,
        internalName,
        subject,
        status: "failed",
        warnings,
        errorMessage: "File does not appear to contain valid HTML."
      });
      continue;
    }

    if (bulkRequest.executionMode === "dry-run") {
      results.push({
        filename: file.filename,
        internalName,
        subject,
        status: "validated",
        warnings
      });
      continue;
    }

    try {
      const payload = buildEmailPayload({
        filename: file.filename,
        htmlMarkup: inspection.bodyMarkup || file.content,
        internalName,
        subject,
        previewText,
        plainText,
        defaults: bulkRequest.defaults
      });

      let createdId = "";

      if (bulkRequest.defaults.baseEmailId) {
        const cloneResponse = await cloneDraftEmail({
          token,
          baseEmailId: bulkRequest.defaults.baseEmailId,
          cloneName: internalName,
          language: bulkRequest.defaults.language
        });
        createdId = cloneResponse.id;

        await sleep(200);

        await patchDraftEmail({
          token,
          emailId: createdId,
          payload: buildPatchPayload(payload, {
            activeDomain: cloneResponse.activeDomain,
            officeLocationId: cloneResponse.subscriptionDetails?.officeLocationId
          })
        });
      } else {
        const createResponse = await createDraftEmail({
          token,
          payload: buildCreateSeedPayload({
            filename: file.filename,
            htmlMarkup: inspection.bodyMarkup || file.content,
            internalName,
            subject,
            previewText,
            plainText,
            defaults: bulkRequest.defaults
          })
        });
        createdId = createResponse.id;

        await patchDraftEmail({
          token,
          emailId: createdId,
          payload: buildPatchPayload(payload, {
            activeDomain: createResponse.activeDomain,
            officeLocationId: createResponse.subscriptionDetails?.officeLocationId
          })
        });
      }

      results.push({
        filename: file.filename,
        hubspotEmailId: createdId,
        internalName,
        subject,
        status: "created",
        warnings
      });
    } catch (error) {
      results.push({
        filename: file.filename,
        internalName,
        subject,
        status: "failed",
        warnings,
        errorMessage: error instanceof Error ? error.message : "Unknown HubSpot API failure."
      });
    }
  }

  const succeeded = results.filter((item) => item.status !== "failed").length;
  const failed = results.length - succeeded;
  const summaryMode = bulkRequest.executionMode === "dry-run" ? "validated" : "processed";

  return NextResponse.json({
    message: `${results.length} files ${summaryMode}. ${succeeded} succeeded, ${failed} failed.`,
    results
  });
}
