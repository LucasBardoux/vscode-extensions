import { escapeHtml } from "./json-highlight.js";

/** Pretty-prints XML/HTML-ish markup by inserting line breaks and indenting by tag depth. */
export function tryFormatXml(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith("<") || !isWellFormedXml(trimmed)) {
    return undefined;
  }
  return indentXml(trimmed);
}

const TAG_PATTERN = /<(\/?)([a-zA-Z_][\w:.-]*)[^>]*?(\/?)>/g;

/**
 * Lightweight balanced-tag check (not a real XML parser, so it won't catch
 * every malformed document) that works identically in the webview and under
 * plain Node in tests — unlike DOMParser, which only exists in a browser.
 */
function isWellFormedXml(xml: string): boolean {
  const stack: string[] = [];
  let sawTag = false;
  let match: RegExpExecArray | null;
  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(xml)) !== null) {
    const [, closing, name, selfClosing] = match;
    sawTag = true;
    if (closing) {
      if (stack.pop() !== name) {
        return false;
      }
    } else if (!selfClosing) {
      stack.push(name ?? "");
    }
  }
  return sawTag && stack.length === 0;
}

function indentXml(xml: string): string {
  const withBreaks = xml.replace(/>\s*</g, ">\n<");
  let depth = 0;
  const lines: string[] = [];

  for (const rawLine of withBreaks.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const isClosingTag = /^<\//.test(line);
    const isDeclOrComment = /^<[?!]/.test(line);
    const isSelfClosing = /\/>$/.test(line);
    const isOpeningTag = /^<[^/!?]/.test(line) && !isSelfClosing;
    const closesOnSameLine = /^<[^>]+>.*<\/[^>]+>$/.test(line);

    if (isClosingTag) {
      depth = Math.max(0, depth - 1);
    }

    lines.push("  ".repeat(depth) + line);

    if (isOpeningTag && !closesOnSameLine && !isDeclOrComment) {
      depth += 1;
    }
  }

  return lines.join("\n");
}

// Tag names and attribute name/value pairs in a single alternation, matched in
// one left-to-right pass over the (already escaped) source. Doing this as two
// sequential .replace() calls would let the second pass re-match markup the
// first pass just inserted (e.g. its own `class="tok-tag"`), corrupting it.
const XML_TOKEN_PATTERN = /(&lt;\/?)([a-zA-Z_][\w:.-]*)|([a-zA-Z_][\w:.-]*)(=)("[^"]*"|'[^']*')/g;

/** Wraps tag names and attribute name/value pairs in `<span class="tok-*">` for CSS-driven coloring. */
export function highlightXml(pretty: string): string {
  return escapeHtml(pretty).replace(
    XML_TOKEN_PATTERN,
    (
      _match,
      tagPrefix: string | undefined,
      tagName: string | undefined,
      attrName: string | undefined,
      eq: string | undefined,
      attrValue: string | undefined,
    ) => {
      if (tagName !== undefined) {
        return `${tagPrefix}<span class="tok-tag">${tagName}</span>`;
      }
      return `<span class="tok-attr-name">${attrName}</span>${eq}<span class="tok-string">${attrValue}</span>`;
    },
  );
}
