function redactToken(value: string) {
  if (!value) return value;
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    const redacted = value.includes("pat-")
      ? value.replace(/pat-[A-Za-z0-9_-]+/g, (token) => redactToken(token))
      : value;

    if (redacted.length > 500) {
      return `${redacted.slice(0, 500)}...<truncated>`;
    }

    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (/authorization|token/i.test(key)) {
        output[key] = typeof nested === "string" ? redactToken(nested) : "***redacted***";
        continue;
      }
      output[key] = redactSecrets(nested);
    }
    return output;
  }

  return value;
}

export function logHubSpotExchange(label: string, payload: unknown) {
  console.info(`[hubspot-email-bulk-creator] ${label}`, redactSecrets(payload));
}
