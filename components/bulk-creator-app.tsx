"use client";

import { useMemo, useState } from "react";
import type {
  ApiResult,
  ClientFilePreview,
  ExecutionMode,
  HubSpotDefaults,
  ResultSummary,
  RunMode,
  ValidationErrors
} from "@/lib/types";

const INITIAL_DEFAULTS: HubSpotDefaults = {
  fromName: "",
  replyToEmail: "",
  folderId: "",
  campaignId: "",
  language: "en",
  baseEmailId: ""
};

const MAX_TEST_FILE_COUNT = 2;

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function summarizeResults(results: ApiResult[]): ResultSummary {
  return results.reduce(
    (summary, result) => {
      summary.total += 1;
      if (result.status === "created") summary.created += 1;
      if (result.status === "validated") summary.validated += 1;
      if (result.status === "failed") summary.failed += 1;
      return summary;
    },
    { total: 0, created: 0, validated: 0, failed: 0 }
  );
}

function resultsToCsv(results: ApiResult[]) {
  const rows = [
    ["filename", "hubspot_email_id", "internal_name", "subject", "status", "error_message"]
  ];

  for (const result of results) {
    rows.push([
      result.filename,
      result.hubspotEmailId ?? "",
      result.internalName ?? "",
      result.subject ?? "",
      result.status,
      result.errorMessage ?? ""
    ]);
  }

  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`)
        .join(",")
    )
    .join("\n");
}

function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function BulkCreatorApp() {
  const [htmlFiles, setHtmlFiles] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [defaults, setDefaults] = useState<HubSpotDefaults>(INITIAL_DEFAULTS);
  const [runMode, setRunMode] = useState<RunMode>("test-2");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("dry-run");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [results, setResults] = useState<ApiResult[]>([]);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const filePreviews = useMemo<ClientFilePreview[]>(
    () =>
      htmlFiles.map((file) => ({
        filename: file.name,
        size: formatBytes(file.size),
        invalidExtension: !file.name.toLowerCase().endsWith(".html")
      })),
    [htmlFiles]
  );

  const summary = useMemo(() => summarizeResults(results), [results]);
  const percent =
    summary.total === 0
      ? isSubmitting
        ? 20
        : 0
      : Math.round(((summary.created + summary.validated + summary.failed) / summary.total) * 100);

  async function submit() {
    if (htmlFiles.length === 0) {
      setServerMessage("Upload at least one HTML file before continuing.");
      return;
    }

    setIsSubmitting(true);
    setServerMessage(null);
    setValidationErrors({});
    setResults([]);
    setProgressMessage(executionMode === "dry-run" ? "Validating files..." : "Creating draft emails...");

    const formData = new FormData();

    htmlFiles.forEach((file) => formData.append("htmlFiles", file));
    if (csvFile) formData.append("metadataCsv", csvFile);

    formData.append("runMode", runMode);
    formData.append("executionMode", executionMode);
    formData.append("fromName", defaults.fromName);
    formData.append("replyToEmail", defaults.replyToEmail);
    formData.append("folderId", defaults.folderId);
    formData.append("campaignId", defaults.campaignId);
    formData.append("language", defaults.language || "en");
    formData.append("baseEmailId", defaults.baseEmailId);

    try {
      const response = await fetch("/api/bulk-create", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as {
        message?: string;
        results?: ApiResult[];
        validationErrors?: ValidationErrors;
      };

      if (!response.ok) {
        if (payload.validationErrors) {
          setValidationErrors(payload.validationErrors);
        }
        throw new Error(payload.message || "Request failed.");
      }

      setResults(payload.results ?? []);
      setServerMessage(payload.message ?? null);
      setProgressMessage(executionMode === "dry-run" ? "Validation complete." : "Draft creation complete.");
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unexpected request failure.");
      setProgressMessage("Run failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-card">
          <span className="hero-kicker">Internal marketing operations</span>
          <h1>HubSpot Email Bulk Creator</h1>
          <p>
            Upload a batch of HTML files, optionally map metadata from a CSV, validate everything safely,
            and create draft HubSpot marketing emails without ever publishing them.
          </p>
        </div>
        <aside className="hero-card hero-aside">
          <div className="stat">
            <strong>Dry run first</strong>
            Safe validation mode checks filenames, metadata, HTML structure, and payload readiness without calling HubSpot.
          </div>
          <div className="stat">
            <strong>Drafts only</strong>
            The server only uses draft creation and draft patch endpoints. No publish action exists in this UI or backend.
          </div>
          <div className="stat">
            <strong>Server-side token only</strong>
            HubSpot access is expected to come from a secure environment variable. Logs still redact secrets automatically.
          </div>
        </aside>
      </section>

      <section className="content-grid">
        <div className="stack">
          <div className="panel stack">
            <div>
              <h2>1. Upload files</h2>
              <p>Choose one or more <code className="inline">.html</code> files and an optional metadata CSV.</p>
            </div>

            <div className="dropzone">
              <label className="field">
                <span>HTML files</span>
                <input
                  type="file"
                  accept=".html,text/html"
                  multiple
                  onChange={(event) => setHtmlFiles(Array.from(event.target.files ?? []))}
                />
              </label>
            </div>

            <div className="dropzone">
              <label className="field">
                <span>Metadata CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                />
                <small>Optional columns: <code className="inline">filename</code>, <code className="inline">subject</code>, <code className="inline">preview_text</code>, <code className="inline">internal_name</code>.</small>
              </label>
            </div>

            <div className="file-list">
              {filePreviews.length === 0 ? (
                <div className="note">No HTML files selected yet.</div>
              ) : (
                filePreviews.map((file) => (
                  <div className="file-card" key={file.filename}>
                    <strong>{file.filename}</strong>
                    <div className="meta-row">
                      <span>{file.size}</span>
                      {file.invalidExtension ? <span className="pill error">Invalid extension</span> : <span className="pill success">HTML file</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel stack">
            <div>
              <h2>2. Settings</h2>
              <p>Configure token and draft defaults. Leave optional fields blank if your base email or account defaults already cover them.</p>
            </div>

            {validationErrors.settings ? (
              <div className="status-banner error">{validationErrors.settings}</div>
            ) : null}

            <div className="note">
              Best design fidelity usually comes from inline styles plus a base email in clone mode. HubSpot may sanitize advanced CSS or head-level styling in standard create mode.
            </div>

            <div className="note">
              This app now reads the HubSpot token from the server environment only. In Netlify, set <code className="inline">HUBSPOT_PRIVATE_APP_TOKEN</code> once and leave it out of the UI.
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Language</span>
                <input
                  value={defaults.language}
                  onChange={(event) => setDefaults((current) => ({ ...current, language: event.target.value }))}
                  placeholder="en"
                />
                {validationErrors.language ? <div className="status-banner error">{validationErrors.language}</div> : null}
              </label>

              <label className="field">
                <span>From name</span>
                <input
                  value={defaults.fromName}
                  onChange={(event) => setDefaults((current) => ({ ...current, fromName: event.target.value }))}
                  placeholder="Marketing Team"
                />
                {validationErrors.fromName ? <div className="status-banner error">{validationErrors.fromName}</div> : null}
              </label>

              <label className="field">
                <span>Reply-to email</span>
                <input
                  value={defaults.replyToEmail}
                  onChange={(event) => setDefaults((current) => ({ ...current, replyToEmail: event.target.value }))}
                  placeholder="marketing@example.com"
                />
                {validationErrors.replyToEmail ? <div className="status-banner error">{validationErrors.replyToEmail}</div> : null}
              </label>

              <label className="field">
                <span>Folder ID</span>
                <input
                  value={defaults.folderId}
                  onChange={(event) => setDefaults((current) => ({ ...current, folderId: event.target.value }))}
                  placeholder="12345"
                />
                {validationErrors.folderId ? <div className="status-banner error">{validationErrors.folderId}</div> : null}
              </label>

              <label className="field">
                <span>Campaign ID</span>
                <input
                  value={defaults.campaignId}
                  onChange={(event) => setDefaults((current) => ({ ...current, campaignId: event.target.value }))}
                  placeholder="campaign-guid"
                />
                {validationErrors.campaignId ? <div className="status-banner error">{validationErrors.campaignId}</div> : null}
              </label>
            </div>

            {validationErrors.privateToken ? <div className="status-banner error">{validationErrors.privateToken}</div> : null}

            <label className="field">
              <span>Base email clone mode</span>
              <input
                value={defaults.baseEmailId}
                onChange={(event) => setDefaults((current) => ({ ...current, baseEmailId: event.target.value }))}
                placeholder="Optional existing HubSpot email ID"
              />
              <small>If provided, the app clones that draft/template first and then patches the cloned draft content.</small>
              {validationErrors.baseEmailId ? <div className="status-banner error">{validationErrors.baseEmailId}</div> : null}
            </label>
          </div>
        </div>

        <div className="stack">
          <div className="panel stack">
            <div>
              <h2>3. Run mode</h2>
              <p>Choose how many files to process and whether this pass should validate only or create drafts.</p>
            </div>

            <div className="field">
              <label>Volume</label>
              <div className="segmented">
                <button className={runMode === "test-1" ? "active" : ""} type="button" onClick={() => setRunMode("test-1")}>
                  First 1
                </button>
                <button className={runMode === "test-2" ? "active" : ""} type="button" onClick={() => setRunMode("test-2")}>
                  First 2
                </button>
                <button className={runMode === "all" ? "active" : ""} type="button" onClick={() => setRunMode("all")}>
                  Run all
                </button>
              </div>
            </div>

            <div className="field">
              <label>Execution</label>
              <div className="segmented">
                <button className={executionMode === "dry-run" ? "active" : ""} type="button" onClick={() => setExecutionMode("dry-run")}>
                  Dry run
                </button>
                <button className={executionMode === "create" ? "active" : ""} type="button" onClick={() => setExecutionMode("create")}>
                  Create drafts
                </button>
                <button className={executionMode === "create" && runMode === "all" ? "active" : ""} type="button" onClick={() => {
                  setExecutionMode("create");
                  setRunMode("all");
                }}>
                  Full batch
                </button>
              </div>
            </div>

            <div className="note">
              Test mode processes at most {MAX_TEST_FILE_COUNT} files. Dry run mode never calls HubSpot.
            </div>

            <div className="action-row">
              <button className="button" type="button" disabled={isSubmitting} onClick={submit}>
                {isSubmitting ? "Working..." : executionMode === "dry-run" ? "Validate batch" : "Create drafts"}
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={results.length === 0}
                onClick={() => downloadCsv("hubspot-email-results.csv", resultsToCsv(results))}
              >
                Download results CSV
              </button>
            </div>

            {progressMessage ? (
              <div className="stack">
                <div className="meta-row">
                  <span>{progressMessage}</span>
                  <span>{percent}% complete</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            ) : null}

            {serverMessage ? (
              <div className={`status-banner ${summary.failed > 0 ? "warning" : "success"}`}>{serverMessage}</div>
            ) : null}
          </div>

          <div className="panel stack">
            <div>
              <h2>4. Results</h2>
              <p>Every file returns a row, including failures and dry-run validation warnings.</p>
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <strong>{summary.total}</strong>
                Total processed
              </div>
              <div className="summary-card">
                <strong>{summary.created + summary.validated}</strong>
                Successes
              </div>
              <div className="summary-card">
                <strong>{summary.failed}</strong>
                Failed
              </div>
            </div>

            <div className="result-list">
              {results.length === 0 ? (
                <div className="note">Results will appear here after validation or draft creation.</div>
              ) : (
                results.map((result) => (
                  <div className="result-card" key={`${result.filename}-${result.hubspotEmailId ?? result.status}`}>
                    <strong>{result.filename}</strong>
                    <div className="meta-row">
                      <span className={`pill ${result.status === "failed" ? "error" : result.status === "created" ? "success" : "warning"}`}>
                        {result.status}
                      </span>
                      {result.hubspotEmailId ? <span>Email ID: {result.hubspotEmailId}</span> : null}
                      {result.internalName ? <span>Internal name: {result.internalName}</span> : null}
                    </div>
                    <div className="meta-row">
                      <span>Subject: {result.subject || "None provided"}</span>
                    </div>
                    {result.warnings?.length ? (
                      <div className="warning-list">
                        {result.warnings.map((warning) => (
                          <div className="pill warning" key={warning}>
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {result.errorMessage ? <div className="status-banner error">{result.errorMessage}</div> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
