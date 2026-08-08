/** Short, human label for a content-type header, used as a compact list column (e.g. "json", "png"). */
export function shortContentTypeLabel(contentType: string | undefined): string {
  if (!contentType) {
    return "";
  }
  const mimeType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!mimeType) {
    return "";
  }
  const subtype = mimeType.split("/")[1] ?? mimeType;
  if (mimeType === "application/json" || subtype.endsWith("+json")) {
    return "json";
  }
  if (mimeType === "text/html") {
    return "html";
  }
  if (mimeType === "text/css") {
    return "css";
  }
  if (mimeType === "application/javascript" || mimeType === "text/javascript") {
    return "js";
  }
  if (mimeType.startsWith("text/")) {
    return "text";
  }
  if (mimeType.startsWith("image/")) {
    return subtype;
  }
  if (mimeType.startsWith("font/")) {
    return "font";
  }
  if (mimeType === "application/xml" || subtype.endsWith("+xml")) {
    return "xml";
  }
  return subtype.length > 12 ? subtype.slice(0, 12) : subtype;
}
