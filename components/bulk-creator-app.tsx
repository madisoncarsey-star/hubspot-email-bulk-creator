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
  uploadDirectory: "marketing-email-uploads"
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
      if (result.status === "uploaded") summary.uploaded += 1;
      if (result.status === "validated") summary.validated += 1;
      if (result.status === "failed") summary.failed += 1;
      return summary;
    },
    { total: 0, uploaded: 0, validated: 0, failed: 0 }
  );
}

function resultsToCsv(results: ApiResult[]) {
  const rows = [["filename", "hubspot_path", "status", "error_message"]];

  for (const result of results) {
    rows.push([
      result.filename,
      result.hubspotPath ?? "",
      result.status,
      result.errorMessage ?? ""
    ]);
  }

  return rows
    .map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))
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
      : Math.round(((summary.uploaded + summary.validated + summary.failed) / summary.total) * 100);

  async function submit() {
    if (htmlFiles.length === 0) {
      setServerMessage("Upload at least one HTML file before continuing.");
      setValidationErrors({ htmlFiles: "Upload at least one .html file." });
      return;
    }

    setIsSubmitting(true);
    setServerMessage(null);
    setValidationErrors({});
    setResults([]);
    setProgressMessage(executionMode === "dry-run" ? "Validating files..." : "Uploading files to HubSpot...");

    const formData = new FormData();
    htmlFiles.forEach((file) => formData.append("htmlFiles", file));
    formData.append("runMode", runMode);
    formData.append("executionMode", executionMode);
    formData.append("uploadDirectory", defaults.uploadDirectory);

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
      setProgressMessage(executionMode === "dry-run" ? "Validation complete." : "Upload complete.");
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
          <span className="hero-kicker">Phase 1: HubSpot file upload</span>
          <h1>HubSpot HTML Bulk Uploader</h1>
          <p>
            Upload raw HTML files into HubSpot Design Manager as draft source-code files. This phase skips drag-and-drop emails entirely and preserves your original markup.
          </p>
        </div>
        <aside className="hero-card hero-aside">
          <div className="stat">
            <strong>Draft source code only</strong>
            Files are uploaded to HubSpot&apos;s draft CMS source code environment, not published live.
          </div>
          <div className="stat">
            <strong>Validation first</strong>
            Dry run checks the files locally. Upload mode also asks HubSpot to validate each HTML file before saving it.
          </div>
          <div className="stat">
            <strong>Server-side token only</strong>
            HubSpot access comes from the secure <code className="inline">HUBSPOT_PRIVATE_APP_TOKEN</code> environment variable.
          </div>
        </aside>
      </section>

      <section className="content-grid">
        <div className="stack">
          <div className="panel stack">
            <div>
              <h2>1. Upload files</h2>
              <p>Choose one or more <code className="inline">.html</code> files to upload into HubSpot.</p>
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

            {validationErrors.htmlFiles ? <div className="status-banner error">{validationErrors.htmlFiles}</div> : null}

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
              <p>Choose the HubSpot folder path where uploaded files should land inside Design Manager.</p>
            </div>

            {validationErrors.settings ? <div className="status-banner error">{validationErrors.settings}</div> : null}

            <div className="note">
              Example folder path: <code className="inline">marketing-email-uploads</code> or <code className="inline">marketing/email-templates/spring</code>.
            </div>

            <div className="note">
              If upload mode says a token is missing, set <code className="inline">HUBSPOT_PRIVATE_APP_TOKEN</code> in Netlify and redeploy.
            </div>

            <label className="field">
              <span>HubSpot upload folder</span>
              <input
                value={defaults.uploadDirectory}
                onChange={(event) => setDefaults((current) => ({ ...current, uploadDirectory: event.target.value }))}
                placeholder="marketing-email-uploads"
              />
              <small>The app saves files into HubSpot draft source code under this folder.</small>
              {validationErrors.uploadDirectory ? <div className="status-banner error">{validationErrors.uploadDirectory}</div> : null}
            </label>

            {validationErrors.privateToken ? <div className="status-banner error">{validationErrors.privateToken}</div> : null}
          </div>
        </div>

        <div className="stack">
          <div className="panel stack">
            <div>
              <h2>3. Run mode</h2>
              <p>Use dry run to sanity-check files, then upload the first 1 or 2 before running the full batch.</p>
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
                  Upload files
                </button>
                <button
                  className={executionMode === "create" && runMode === "all" ? "active" : ""}
                  type="button"
                  onClick={() => {
                    setExecutionMode("create");
                    setRunMode("all");
                  }}
                >
                  Full batch
                </button>
              </div>
            </div>

            <div className="note">
              Test mode processes at most {MAX_TEST_FILE_COUNT} files. Dry run never calls HubSpot. Upload mode validates each file with HubSpot before saving it.
            </div>

            <div className="action-row">
              <button className="button" type="button" disabled={isSubmitting} onClick={submit}>
                {isSubmitting ? "Working..." : executionMode === "dry-run" ? "Validate batch" : "Upload to HubSpot"}
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={results.length === 0}
                onClick={() => downloadCsv("hubspot-html-upload-results.csv", resultsToCsv(results))}
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
              <p>Each row shows the HubSpot draft path that was validated or uploaded.</p>
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <strong>{summary.total}</strong>
                Total processed
              </div>
              <div className="summary-card">
                <strong>{summary.uploaded + summary.validated}</strong>
                Successes
              </div>
              <div className="summary-card">
                <strong>{summary.failed}</strong>
                Failed
              </div>
            </div>

            <div className="result-list">
              {results.length === 0 ? (
                <div className="note">Results will appear here after validation or upload.</div>
              ) : (
                results.map((result) => (
                  <div className="result-card" key={`${result.filename}-${result.hubspotPath ?? result.status}`}>
                    <strong>{result.filename}</strong>
                    <div className="meta-row">
                      <span className={`pill ${result.status === "failed" ? "error" : result.status === "uploaded" ? "success" : "warning"}`}>
                        {result.status}
                      </span>
                      {result.hubspotPath ? <span>HubSpot path: {result.hubspotPath}</span> : null}
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
