import type { NetworkEntry } from "@network-monitor/core";
import { renderHeadersSection, findHeaderValue } from "./headers-view.js";
import { renderBodySection } from "./body-view.js";
import { shortContentTypeLabel } from "./content-type.js";
import { copyButton } from "./ui.js";
import { buildCurlCommand } from "./curl.js";

interface EntriesMessage {
  type: "entries";
  entries: NetworkEntry[];
}

interface PausedMessage {
  type: "paused";
  paused: boolean;
}

type IncomingMessage = EntriesMessage | PausedMessage;

let entries: NetworkEntry[] = [];
let selectedId: string | undefined;
let filterText = "";
let paused = false;

const root = document.getElementById("root");
if (!root) {
  throw new Error("Network Monitor webview: #root element not found");
}

root.innerHTML = `
  <div class="nm-container">
    <div class="nm-toolbar">
      <input class="nm-filter" type="text" placeholder="Filter by method, URL, or status" />
      <span class="nm-count"></span>
      <span class="nm-paused-badge" hidden>Paused</span>
    </div>
    <div class="nm-body">
      <div class="nm-list" role="list"></div>
      <div class="nm-resizer" role="separator" aria-orientation="horizontal"></div>
      <div class="nm-detail" hidden></div>
    </div>
  </div>
`;

const filterInput = root.querySelector<HTMLInputElement>(".nm-filter");
const countEl = root.querySelector<HTMLSpanElement>(".nm-count");
const listEl = root.querySelector<HTMLDivElement>(".nm-list");
const detailEl = root.querySelector<HTMLDivElement>(".nm-detail");
const pausedBadge = root.querySelector<HTMLSpanElement>(".nm-paused-badge");
const bodyEl = root.querySelector<HTMLDivElement>(".nm-body");
const resizerEl = root.querySelector<HTMLDivElement>(".nm-resizer");

filterInput?.addEventListener("input", () => {
  filterText = filterInput.value.trim().toLowerCase();
  render();
});

setupResizer();

window.addEventListener("message", (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  if (message.type === "entries") {
    entries = message.entries;
    render();
  } else if (message.type === "paused") {
    paused = message.paused;
    render();
  }
});

function matchesFilter(entry: NetworkEntry): boolean {
  if (!filterText) {
    return true;
  }
  const haystack = `${entry.method} ${entry.url} ${entry.status ?? ""}`.toLowerCase();
  return haystack.includes(filterText);
}

function statusClass(entry: NetworkEntry): string {
  if (entry.error) {
    return "nm-status-error";
  }
  if (entry.pending || entry.status === undefined) {
    return "nm-status-pending";
  }
  if (entry.status >= 500) {
    return "nm-status-5xx";
  }
  if (entry.status >= 400) {
    return "nm-status-4xx";
  }
  return "nm-status-2xx";
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false });
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) {
    return "";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function render(): void {
  if (pausedBadge) {
    pausedBadge.hidden = !paused;
  }
  renderList();
  renderDetail();
}

function renderList(): void {
  if (!listEl) {
    return;
  }
  const visible = entries.filter(matchesFilter);
  if (countEl) {
    countEl.textContent = filterText
      ? `${visible.length} / ${entries.length}`
      : entries.length
        ? String(entries.length)
        : "";
  }
  listEl.innerHTML = "";

  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "nm-empty";
    empty.textContent =
      entries.length === 0 ? "No requests captured yet." : "No requests match the filter.";
    listEl.appendChild(empty);
    return;
  }

  for (const entry of [...visible].reverse()) {
    const row = document.createElement("div");
    row.className = "nm-row" + (entry.id === selectedId ? " nm-row-selected" : "");
    row.setAttribute("role", "listitem");
    row.tabIndex = 0;

    const status = document.createElement("span");
    status.className = "nm-cell nm-status " + statusClass(entry);
    status.textContent = entry.error ? "ERR" : entry.pending ? "…" : String(entry.status ?? "");

    const method = document.createElement("span");
    method.className = "nm-cell nm-method";
    method.textContent = entry.method;

    const type = document.createElement("span");
    type.className = "nm-cell nm-type";
    type.textContent = shortContentTypeLabel(
      findHeaderValue(entry.responseHeaders, "content-type"),
    );

    const url = document.createElement("span");
    url.className = "nm-cell nm-url";
    url.textContent = entry.url;
    url.title = entry.url;

    const duration = document.createElement("span");
    duration.className = "nm-cell nm-duration";
    duration.textContent = formatDuration(entry.durationMs);

    const time = document.createElement("span");
    time.className = "nm-cell nm-time";
    time.textContent = formatTime(entry.startedAt);

    row.append(status, method, type, url, duration, time);
    row.addEventListener("click", () => {
      selectedId = entry.id;
      render();
    });
    listEl.appendChild(row);
  }
}

function renderDetail(): void {
  if (!detailEl) {
    return;
  }
  const entry = entries.find((e) => e.id === selectedId);
  if (!entry) {
    detailEl.hidden = true;
    detailEl.innerHTML = "";
    return;
  }

  detailEl.hidden = false;
  detailEl.innerHTML = "";

  const header = document.createElement("div");
  header.className = "nm-detail-header";

  const titleRow = document.createElement("div");
  titleRow.className = "nm-detail-title-row";
  const statusPill = document.createElement("span");
  statusPill.className = "nm-status-pill " + statusClass(entry);
  statusPill.textContent = entry.error ? "ERR" : entry.pending ? "…" : String(entry.status ?? "");
  const title = document.createElement("span");
  title.className = "nm-detail-title";
  title.textContent = `${entry.method} ${entry.url}`;
  title.title = entry.url;
  titleRow.append(statusPill, title);

  const meta = document.createElement("div");
  meta.className = "nm-detail-meta";
  const metaParts = [
    entry.source,
    formatDuration(entry.durationMs),
    formatTime(entry.startedAt),
  ].filter(Boolean);
  meta.textContent = metaParts.join(" · ");

  const actions = document.createElement("div");
  actions.className = "nm-detail-actions";
  actions.appendChild(copyButton(() => buildCurlCommand(entry), "Copy as cURL"));

  header.append(titleRow, meta, actions);
  detailEl.appendChild(header);

  const scroll = document.createElement("div");
  scroll.className = "nm-detail-scroll";
  detailEl.appendChild(scroll);

  if (entry.error) {
    scroll.appendChild(renderErrorSection(entry.error));
  }

  scroll.appendChild(renderHeadersSection("Request Headers", entry.requestHeaders));
  scroll.appendChild(
    renderBodySection({
      title: "Request Body",
      text: entry.requestBody,
      encoding: entry.requestBodyEncoding,
      truncated: entry.requestBodyTruncated,
      contentType: findHeaderValue(entry.requestHeaders, "content-type"),
    }),
  );

  if (entry.responseHeaders) {
    scroll.appendChild(renderHeadersSection("Response Headers", entry.responseHeaders));
  }
  if (entry.responseBody !== undefined) {
    scroll.appendChild(
      renderBodySection({
        title: "Response Body",
        text: entry.responseBody,
        encoding: entry.responseBodyEncoding,
        truncated: entry.responseBodyTruncated,
        contentType: findHeaderValue(entry.responseHeaders, "content-type"),
      }),
    );
  }
}

function renderErrorSection(message: string): HTMLElement {
  const section = document.createElement("div");
  section.className = "nm-section";
  const header = document.createElement("div");
  header.className = "nm-section-header";
  const title = document.createElement("span");
  title.className = "nm-section-title nm-section-title-error";
  title.textContent = "Error";
  header.appendChild(title);
  section.appendChild(header);
  const pre = document.createElement("pre");
  pre.className = "nm-code nm-code-plain nm-code-error";
  pre.textContent = message;
  section.appendChild(pre);
  return section;
}

function setupResizer(): void {
  if (!resizerEl || !bodyEl || !detailEl) {
    return;
  }
  let dragging = false;

  resizerEl.addEventListener("mousedown", (event) => {
    dragging = true;
    event.preventDefault();
  });

  window.addEventListener("mousemove", (event) => {
    if (!dragging) {
      return;
    }
    const rect = bodyEl.getBoundingClientRect();
    const detailHeight = rect.bottom - event.clientY;
    const percent = Math.min(85, Math.max(15, (detailHeight / rect.height) * 100));
    detailEl.style.flexBasis = `${percent}%`;
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });
}

render();
