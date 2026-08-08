import type { NetworkEntry } from "@network-monitor/core";

/** Builds a copy-pasteable curl command. Redacted header values are copied as-is ("[redacted]"). */
export function buildCurlCommand(entry: NetworkEntry): string {
  const parts = [`curl -X ${entry.method}`, quote(entry.url)];

  for (const [key, value] of Object.entries(entry.requestHeaders)) {
    parts.push(`-H ${quote(`${key}: ${value}`)}`);
  }

  if (entry.requestBody !== undefined && entry.requestBodyEncoding === "utf8") {
    parts.push(`--data-raw ${quote(entry.requestBody)}`);
  } else if (entry.requestBody !== undefined) {
    parts.push("# request body is binary and omitted from this command");
  }

  return parts.join(" \\\n  ");
}

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
