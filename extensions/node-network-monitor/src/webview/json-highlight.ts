export function tryFormatJson(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return undefined;
  }
}

const TOKEN_PATTERN =
  /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** Wraps tokens of pretty-printed JSON text in `<span class="tok-*">` for CSS-driven syntax coloring. */
export function highlightJson(pretty: string): string {
  return escapeHtml(pretty).replace(TOKEN_PATTERN, (match) => {
    if (match.startsWith('"')) {
      return `<span class="${match.endsWith(":") ? "tok-key" : "tok-string"}">${match}</span>`;
    }
    if (match === "true" || match === "false") {
      return `<span class="tok-boolean">${match}</span>`;
    }
    if (match === "null") {
      return `<span class="tok-null">${match}</span>`;
    }
    return `<span class="tok-number">${match}</span>`;
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
