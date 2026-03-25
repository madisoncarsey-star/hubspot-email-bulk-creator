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
  fromName: string;
  replyToEmail: string;
  folderId: string;
  campaignId: string;
  language: string;
  baseEmailId: string;
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
  hubspotEmailId?: string;
  internalName?: string;
  subject?: string;
  status: "validated" | "created" | "failed";
  warnings?: string[];
  errorMessage?: string;
}

export interface ResultSummary {
  total: number;
  created: number;
  validated: number;
  failed: number;
}

export interface ClientFilePreview {
  filename: string;
  size: string;
  invalidExtension: boolean;
}

export interface HubSpotEmailResponse {
  id: string;
  name?: string;
  subject?: string;
  state?: string;
}

export interface RetryOptions {
  retries: number;
  minDelayMs: number;
  maxDelayMs: number;
}
