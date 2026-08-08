import { tryFormatJson, highlightJson } from "./json-highlight.js";
import { tryFormatXml, highlightXml } from "./xml-highlight.js";
import { copyButton } from "./ui.js";

export interface BodyViewOptions {
  title: string;
  text: string | undefined;
  encoding: "utf8" | "base64";
  truncated: boolean;
  contentType: string | undefined;
}

export function renderBodySection(options: BodyViewOptions): HTMLElement {
  const section = document.createElement("div");
  section.className = "nm-section";

  const header = document.createElement("div");
  header.className = "nm-section-header";
  const title = document.createElement("span");
  title.className = "nm-section-title";
  title.textContent = options.title;
  header.appendChild(title);
  if (options.truncated) {
    const badge = document.createElement("span");
    badge.className = "nm-badge nm-badge-truncated";
    badge.textContent = "truncated";
    header.appendChild(badge);
  }
  section.appendChild(header);

  if (options.text === undefined || options.text.length === 0) {
    const empty = document.createElement("div");
    empty.className = "nm-empty-inline";
    empty.textContent = "(no body)";
    section.appendChild(empty);
    return section;
  }

  if (options.encoding === "base64") {
    section.appendChild(renderBinaryBody(header, options));
    return section;
  }

  const pretty = tryFormatJson(options.text);
  if (pretty !== undefined) {
    section.appendChild(
      renderFormattedBody(
        header,
        pretty,
        options.text,
        highlightJson,
        "Toggle between pretty-printed and raw JSON",
      ),
    );
    return section;
  }

  const prettyXml = tryFormatXml(options.text);
  if (prettyXml !== undefined) {
    section.appendChild(
      renderFormattedBody(
        header,
        prettyXml,
        options.text,
        highlightXml,
        "Toggle between pretty-printed and raw XML",
      ),
    );
    return section;
  }

  section.appendChild(renderPlainTextBody(header, options.text));
  return section;
}

function renderFormattedBody(
  header: HTMLElement,
  pretty: string,
  raw: string,
  highlight: (pretty: string) => string,
  toggleTitle: string,
): HTMLElement {
  let showingRaw = false;

  const pre = document.createElement("pre");
  pre.className = "nm-code";
  pre.innerHTML = highlight(pretty);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nm-btn nm-btn-toggle";
  toggle.textContent = "Raw";
  toggle.title = toggleTitle;
  toggle.addEventListener("click", () => {
    showingRaw = !showingRaw;
    if (showingRaw) {
      pre.textContent = raw;
      toggle.textContent = "Pretty";
    } else {
      pre.innerHTML = highlight(pretty);
      toggle.textContent = "Raw";
    }
  });

  header.appendChild(toggle);
  header.appendChild(copyButton(() => (showingRaw ? raw : pretty)));

  return pre;
}

function renderPlainTextBody(header: HTMLElement, text: string): HTMLElement {
  header.appendChild(copyButton(() => text));
  const pre = document.createElement("pre");
  pre.className = "nm-code nm-code-plain";
  pre.textContent = text;
  return pre;
}

function renderBinaryBody(header: HTMLElement, options: BodyViewOptions): HTMLElement {
  const text = options.text ?? "";
  const byteLength = approxBase64ByteLength(text);
  header.appendChild(copyButton(() => text, "Copy base64"));

  const contentType = options.contentType ?? "application/octet-stream";

  if (isImageContentType(contentType)) {
    if (options.truncated) {
      return binaryNote(
        `Image truncated at ${formatBytes(byteLength)} before capture — increase "nodeNetworkMonitor.maxBodyBytes" to preview it.`,
      );
    }
    return renderMedia("img", contentType, text, byteLength);
  }

  if (isAudioContentType(contentType)) {
    if (options.truncated) {
      return binaryNote(
        `Audio truncated at ${formatBytes(byteLength)} before capture — cannot play.`,
      );
    }
    return renderMedia("audio", contentType, text, byteLength);
  }

  if (isVideoContentType(contentType)) {
    if (options.truncated) {
      return binaryNote(
        `Video truncated at ${formatBytes(byteLength)} before capture — cannot play.`,
      );
    }
    return renderMedia("video", contentType, text, byteLength);
  }

  return binaryNote(`Binary body (${contentType}, ${formatBytes(byteLength)}, base64-encoded).`);
}

function renderMedia(
  kind: "img" | "audio" | "video",
  contentType: string,
  base64: string,
  byteLength: number,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = kind === "img" ? "nm-image-wrapper" : "nm-media-wrapper";

  const src = `data:${contentType};base64,${base64}`;
  const caption = document.createElement("div");
  caption.className = "nm-image-caption";
  caption.textContent = formatBytes(byteLength);

  if (kind === "img") {
    const img = document.createElement("img");
    img.className = "nm-image-preview";
    img.alt = "Response body preview";
    img.addEventListener("load", () => {
      caption.textContent = `${img.naturalWidth}×${img.naturalHeight} · ${formatBytes(byteLength)}`;
    });
    img.addEventListener("error", () => {
      caption.textContent = `Could not decode image preview (${formatBytes(byteLength)}) — the data may not be a valid ${contentType} file.`;
    });
    img.src = src;
    wrapper.addEventListener("click", () => wrapper.classList.toggle("nm-image-expanded"));
    wrapper.append(img, caption);
    return wrapper;
  }

  const media = document.createElement(kind);
  media.className = "nm-media-preview";
  media.controls = true;
  media.src = src;
  media.addEventListener("error", () => {
    caption.textContent = `Could not decode ${kind} preview (${formatBytes(byteLength)}) — the data may not be a valid ${contentType} file.`;
  });
  wrapper.append(media, caption);
  return wrapper;
}

function binaryNote(message: string): HTMLElement {
  const note = document.createElement("div");
  note.className = "nm-empty-inline";
  note.textContent = message;
  return note;
}

function isImageContentType(contentType: string): boolean {
  return /^image\//i.test(contentType.split(";")[0]?.trim() ?? "");
}

function isAudioContentType(contentType: string): boolean {
  return /^audio\//i.test(contentType.split(";")[0]?.trim() ?? "");
}

function isVideoContentType(contentType: string): boolean {
  return /^video\//i.test(contentType.split(";")[0]?.trim() ?? "");
}

function approxBase64ByteLength(base64: string): number {
  const withoutPadding = base64.replace(/=+$/, "");
  return Math.floor((withoutPadding.length * 3) / 4);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
