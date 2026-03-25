import { NextResponse } from "next/server";
import { resolveToken } from "@/lib/config";
import { inspectHtml, sanitizeFilename } from "@/lib/html";
import { uploadSourceCodeFile, validateSourceCodeFile } from "@/lib/hubspot";
import type {
  ApiResult,
  BulkCreateRequest,
  UploadFileRecord,
  ValidationErrors
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function badRequest(message: string, validationErrors?: ValidationErrors) {
  return NextResponse.json({ message, validationErrors }, { status: 400 });
}

function normalizeUploadLimit(runMode: string, files: UploadFileRecord[]) {
  if (runMode === "test-1") return files.slice(0, 1);
  if (runMode === "test-2") return files.slice(0, 2);
  return files;
}

function sanitizeDirectory(input: string) {
  return input
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/[^\w\-./]+/g, "-")
    .replace(/\/$/, "");
}

function buildHubSpotPath(directory: string, filename: string) {
  const safeFilename = sanitizeFilename(filename);
  return directory ? `${directory}/${safeFilename}` : safeFilename;
}

function buildValidationErrors(request: BulkCreateRequest, resolvedToken: string) {
  const validationErrors: ValidationErrors = {};

  if (request.executionMode === "create" && !resolvedToken) {
    validationErrors.privateToken = "Set HUBSPOT_PRIVATE_APP_TOKEN in Netlify before uploading files to HubSpot.";
    validationErrors.settings = "A server-side HubSpot token is required for upload mode.";
  }

  if (!request.defaults.uploadDirectory.trim()) {
    validationErrors.uploadDirectory = "Enter a folder path like marketing-email-uploads.";
    validationErrors.settings = "One or more settings need attention before you can continue.";
  }

  return validationErrors;
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
  const executionMode = String(formData.get("executionMode") || "dry-run");
  const runMode = String(formData.get("runMode") || "test-2");

  if (htmlFiles.length === 0) {
    return badRequest("At least one HTML file is required.", {
      htmlFiles: "Upload at least one .html file."
    });
  }

  const uploadRecords = normalizeUploadLimit(
    runMode,
    await Promise.all(htmlFiles.map((file) => formFileToRecord(file)))
  );

  if (uploadRecords.some((file) => !file.filename.toLowerCase().endsWith(".html"))) {
    return badRequest("Every uploaded file must end with .html.", {
      htmlFiles: "Only .html files are supported in this phase."
    });
  }

  const bulkRequest: BulkCreateRequest = {
    executionMode: executionMode === "create" ? "create" : "dry-run",
    runMode: runMode === "test-1" || runMode === "test-2" || runMode === "all" ? runMode : "test-2",
    defaults: {
      uploadDirectory: sanitizeDirectory(
        String(formData.get("uploadDirectory") || "").trim() || "marketing-email-uploads"
      )
    }
  };

  const token = bulkRequest.executionMode === "create" ? resolveToken("") : "";
  const validationErrors = buildValidationErrors(bulkRequest, token);
  if (Object.keys(validationErrors).length > 0) {
    return badRequest("Fix the highlighted settings and try again.", validationErrors);
  }

  const results: ApiResult[] = [];

  for (const file of uploadRecords) {
    const inspection = inspectHtml(file.content);
    const hubspotPath = buildHubSpotPath(bulkRequest.defaults.uploadDirectory, file.filename);
    const warnings = [...inspection.warnings];

    if (!inspection.isProbablyHtml) {
      results.push({
        filename: file.filename,
        hubspotPath,
        status: "failed",
        warnings,
        errorMessage: "File does not appear to contain valid HTML."
      });
      continue;
    }

    if (bulkRequest.executionMode === "dry-run") {
      results.push({
        filename: file.filename,
        hubspotPath,
        status: "validated",
        warnings
      });
      continue;
    }

    try {
      await validateSourceCodeFile({
        token,
        hubspotPath,
        fileContents: file.content
      });

      const uploadResponse = await uploadSourceCodeFile({
        token,
        hubspotPath,
        fileContents: file.content
      });

      results.push({
        filename: file.filename,
        hubspotPath: uploadResponse.path || hubspotPath,
        status: "uploaded",
        warnings
      });
    } catch (error) {
      results.push({
        filename: file.filename,
        hubspotPath,
        status: "failed",
        warnings,
        errorMessage: error instanceof Error ? error.message : "Unknown HubSpot upload failure."
      });
    }
  }

  const succeeded = results.filter((item) => item.status !== "failed").length;
  const failed = results.length - succeeded;
  const summaryMode = bulkRequest.executionMode === "dry-run" ? "validated" : "uploaded";

  return NextResponse.json({
    message: `${results.length} files ${summaryMode}. ${succeeded} succeeded, ${failed} failed.`,
    results
  });
}
