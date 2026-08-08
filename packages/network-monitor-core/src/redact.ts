export const DEFAULT_REDACTED_HEADERS: readonly string[] = [
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
];

/**
 * 2 MB default: large enough that typical JSON/text API payloads and small
 * preview-able images aren't truncated, small enough to keep the in-memory
 * ring buffer bounded for a dev tool.
 */
export const DEFAULT_MAX_BODY_BYTES = 2_000_000;

const REDACTED_PLACEHOLDER = "[redacted]";

export function redactHeaders(
  headers: Record<string, string>,
  redactedHeaderNames: readonly string[] = DEFAULT_REDACTED_HEADERS,
): Record<string, string> {
  const redactedSet = new Set(redactedHeaderNames.map((name) => name.toLowerCase()));
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = redactedSet.has(key.toLowerCase()) ? REDACTED_PLACEHOLDER : value;
  }
  return result;
}

export type BodyEncoding = "utf8" | "base64";

/** MIME (sub)types that are safe/meaningful to decode and display as UTF-8 text. */
const TEXT_CONTENT_TYPE_PATTERN =
  /^text\/|^application\/(json|xml|javascript|x-www-form-urlencoded|yaml)\b|\+(json|xml)$/i;

/**
 * Whether a body should be captured as UTF-8 text vs. base64 (binary).
 * Unknown/missing content types default to text, since most APIs without an
 * explicit content-type are still plain text or JSON.
 */
export function isTextContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return true;
  }
  const mimeType = contentType.split(";")[0]?.trim() ?? "";
  // image/svg+xml would otherwise match the "+xml" text rule; treat all
  // image/* as binary so it's captured and previewed consistently with
  // every other image format.
  if (mimeType.startsWith("image/")) {
    return false;
  }
  return TEXT_CONTENT_TYPE_PATTERN.test(mimeType);
}

export interface EncodedBody {
  text: string;
  encoding: BodyEncoding;
  truncated: boolean;
}

/**
 * Truncates and encodes a captured body based on its content type: text-like
 * content is kept as readable UTF-8, everything else (images, fonts, other
 * binary payloads) is base64-encoded so it can still be previewed/decoded by
 * the panel without being corrupted by a forced UTF-8 conversion.
 */
export function encodeBody(
  body: string | Buffer,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
  contentType: string | undefined = undefined,
): EncodedBody {
  const buffer = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  const truncated = buffer.byteLength > maxBytes;
  const limited = truncated ? buffer.subarray(0, maxBytes) : buffer;

  if (isTextContentType(contentType)) {
    return { text: limited.toString("utf8"), encoding: "utf8", truncated };
  }
  return { text: limited.toString("base64"), encoding: "base64", truncated };
}
