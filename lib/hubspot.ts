import { logHubSpotExchange } from "@/lib/logger";
import { withRetry } from "@/lib/retry";
import type { HubSpotSourceCodeResponse } from "@/lib/types";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";
const SOURCE_CODE_ENVIRONMENT = "draft";

class HubSpotApiError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "HubSpotApiError";
    this.retryable = retryable;
  }
}

function encodeHubSpotPath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function parseResponse(response: Response) {
  const responseText = await response.text();

  try {
    return responseText ? JSON.parse(responseText) : {};
  } catch {
    return responseText;
  }
}

async function hubSpotMultipartFetch<T>({
  path,
  token,
  method,
  filePath,
  fileContents
}: {
  path: string;
  token: string;
  method: "POST" | "PUT";
  filePath: string;
  fileContents: string;
}): Promise<T> {
  return withRetry(async () => {
    const formData = new FormData();
    formData.append("file", new Blob([fileContents], { type: "text/html" }), filePath.split("/").pop() || "upload.html");

    logHubSpotExchange("request", {
      method,
      path,
      authorization: `Bearer ${token}`,
      filePath,
      fileSize: fileContents.length
    });

    const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData,
      cache: "no-store"
    });

    const parsedBody = await parseResponse(response);

    logHubSpotExchange("response", {
      method,
      path,
      status: response.status,
      body: parsedBody
    });

    if (response.ok) {
      return parsedBody as T;
    }

    const isRetriable = response.status === 429 || response.status >= 500;
    const errorMessage =
      typeof parsedBody === "object" && parsedBody && "message" in parsedBody
        ? String((parsedBody as { message?: string }).message)
        : `HubSpot request failed with status ${response.status}.`;

    throw new HubSpotApiError(errorMessage, isRetriable);
  });
}

export async function validateSourceCodeFile({
  token,
  hubspotPath,
  fileContents
}: {
  token: string;
  hubspotPath: string;
  fileContents: string;
}) {
  return hubSpotMultipartFetch<HubSpotSourceCodeResponse>({
    path: `/cms/v3/source-code/${SOURCE_CODE_ENVIRONMENT}/validate/${encodeHubSpotPath(hubspotPath)}`,
    token,
    method: "POST",
    filePath: hubspotPath,
    fileContents
  });
}

export async function uploadSourceCodeFile({
  token,
  hubspotPath,
  fileContents
}: {
  token: string;
  hubspotPath: string;
  fileContents: string;
}) {
  return hubSpotMultipartFetch<HubSpotSourceCodeResponse>({
    path: `/cms/v3/source-code/${SOURCE_CODE_ENVIRONMENT}/content/${encodeHubSpotPath(hubspotPath)}`,
    token,
    method: "PUT",
    filePath: hubspotPath,
    fileContents
  });
}
