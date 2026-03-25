export type RunMode = "test-1" | "test-2" | "all";
export type ExecutionMode = "dry-run" | "create";

export interface CsvMetadataRow {
  filename: string;
  subject?: string;
  preview_text?: string;
  internal_name?: string;
}

export interface UploadFileRecord {
  filename: string;
  originalFilename: string;
  content: string;
  size: number;
}

export interface HubSpotDefaults {
  uploadDirectory: string;
  fromName?: string;
  replyToEmail?: string;
  folderId?: string;
  campaignId?: string;
  language?: string;
  baseEmailId?: string;
}

export interface BulkCreateRequest {
  executionMode: ExecutionMode;
  runMode: RunMode;
  defaults: HubSpotDefaults;
}

export interface HtmlInspection {
  isProbablyHtml: boolean;
  bodyMarkup: string;
  warnings: string[];
  title?: string;
}

export interface HubSpotEmailPayloadInput {
  filename: string;
  htmlMarkup: string;
  internalName: string;
  subject: string;
  previewText: string;
  plainText: string;
  defaults: HubSpotDefaults;
}

export interface ApiResult {
  filename: string;
  hubspotPath?: string;
  status: "validated" | "uploaded" | "failed";
  warnings?: string[];
  errorMessage?: string;
}

export interface ValidationErrors {
  privateToken?: string;
  uploadDirectory?: string;
  settings?: string;
  htmlFiles?: string;
}

export interface ResultSummary {
  total: number;
  uploaded: number;
  validated: number;
  failed: number;
}

export interface ClientFilePreview {
  filename: string;
  size: string;
  invalidExtension: boolean;
}

export interface HubSpotSourceCodeResponse {
  path?: string;
  extension?: string;
  name?: string;
  folder?: boolean;
}

export interface RetryOptions {
  retries: number;
  minDelayMs: number;
  maxDelayMs: number;
}
