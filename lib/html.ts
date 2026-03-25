import type { HtmlInspection } from "@/lib/types";

const ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'"
};

function stripScriptsAndStyles(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function stripScriptsOnly(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function extractHeadStyles(html: string) {
  const styleBlocks = Array.from(html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)).map((match) => match[0].trim());
  return styleBlocks.join("\n");
}

function decodeEntities(text: string) {
  return text.replace(/&(#?[\w\d]+);/g, (_, entity) => {
    if (entity.startsWith("#x")) {
      return String.fromCharCode(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCharCode(parseInt(entity.slice(1), 10));
    }
    return ENTITY_MAP[entity] ?? `&${entity};`;
  });
}

export function sanitizeFilename(filename: string) {
  return filename
    .replace(/^.*[\\/]/, "")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_");
}

export function extractBodyContent(html: string) {
  const withoutScripts = stripScriptsOnly(html).trim();
  const headStyles = extractHeadStyles(withoutScripts);
  const cleaned = withoutScripts.trim();
  const bodyMatch = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]?.trim()) {
    return [headStyles, bodyMatch[1].trim()].filter(Boolean).join("\n");
  }

  const htmlMatch = cleaned.match(/<html\b[^>]*>([\s\S]*?)<\/html>/i);
  if (htmlMatch?.[1]?.trim()) {
    const htmlWithoutHead = htmlMatch[1]
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, "")
      .trim();

    return [headStyles, htmlWithoutHead].filter(Boolean).join("\n");
  }

  return [headStyles, cleaned].filter(Boolean).join("\n");
}

export function generatePlainText(html: string) {
  const withLineBreaks = stripScriptsAndStyles(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|table|tr|li|h[1-6])>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ");

  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeEntities(withoutTags);

  return decoded
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function inspectHtml(html: string): HtmlInspection {
  const warnings: string[] = [];
  const trimmed = html.trim();
  const lower = trimmed.toLowerCase();
  const bodyMarkup = extractBodyContent(trimmed);

  const hasHtmlLikeTags = /<([a-z][a-z0-9]*)\b[^>]*>/i.test(trimmed);
  if (!hasHtmlLikeTags) {
    warnings.push("No HTML tags detected.");
  }

  if ((lower.includes("<html") || lower.includes("<body")) && !lower.includes("</html>") && !lower.includes("</body>")) {
    warnings.push("Document appears truncated because closing html/body tags are missing.");
  }

  if (/<table/i.test(bodyMarkup) && !/<\/table>/i.test(bodyMarkup)) {
    warnings.push("Table markup appears unclosed.");
  }

  if (/<body/i.test(trimmed) && bodyMarkup === trimmed) {
    warnings.push("Body extraction fell back to the original file; body tag may be malformed.");
  }

  if (/<style\b/i.test(trimmed)) {
    warnings.push("Head CSS was preserved where possible, but HubSpot may still sanitize some advanced email styling.");
  }

  const titleMatch = trimmed.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  return {
    isProbablyHtml: hasHtmlLikeTags,
    bodyMarkup,
    warnings,
    title: titleMatch?.[1]?.trim()
  };
}
