import { logHubSpotExchange } from "@/lib/logger";
import { withRetry } from "@/lib/retry";
import type { HubSpotEmailResponse } from "@/lib/types";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

class HubSpotApiError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "HubSpotApiError";
    this.retryable = retryable;
  }
}

async function hubSpotFetch<T>({
  path,
  token,
  method,
  body
}: {
  path: string;
  token: string;
  method: "POST" | "PATCH";
  body: unknown;
}): Promise<T> {
  return withRetry(async () => {
    logHubSpotExchange("request", {
      method,
      path,
      authorization: `Bearer ${token}`,
      body
    });

    const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const responseText = await response.text();
    let parsedBody: unknown = responseText;

    try {
      parsedBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      parsedBody = responseText;
    }

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

export async function createDraftEmail({
  token,
  payload
}: {
  token: string;
  payload: unknown;
}) {
  return hubSpotFetch<HubSpotEmailResponse>({
    path: "/marketing/v3/emails/",
    token,
    method: "POST",
    body: payload
  });
}

export async function cloneDraftEmail({
  token,
  baseEmailId,
  cloneName,
  language
}: {
  token: string;
  baseEmailId: string;
  cloneName: string;
  language: string;
}) {
  return hubSpotFetch<HubSpotEmailResponse>({
    path: "/marketing/v3/emails/clone",
    token,
    method: "POST",
    body: {
      id: baseEmailId,
      cloneName,
      language
    }
  });
}

export async function patchDraftEmail({
  token,
  emailId,
  payload
}: {
  token: string;
  emailId: string;
  payload: unknown;
}) {
  return hubSpotFetch<HubSpotEmailResponse>({
    path: `/marketing/v3/emails/${emailId}/draft`,
    token,
    method: "PATCH",
    body: payload
  });
}
