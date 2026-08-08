import { copyButton } from "./ui.js";

export function renderHeadersSection(
  title: string,
  headers: Record<string, string> | undefined,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "nm-section";

  const header = document.createElement("div");
  header.className = "nm-section-header";
  const titleEl = document.createElement("span");
  titleEl.className = "nm-section-title";
  titleEl.textContent = title;
  header.appendChild(titleEl);
  section.appendChild(header);

  const entries = Object.entries(headers ?? {});
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "nm-empty-inline";
    empty.textContent = "(none)";
    section.appendChild(empty);
    return section;
  }

  header.appendChild(
    copyButton(() => entries.map(([key, value]) => `${key}: ${value}`).join("\n")),
  );

  const table = document.createElement("div");
  table.className = "nm-headers-table";
  for (const [key, value] of entries) {
    const row = document.createElement("div");
    row.className = "nm-header-row";
    const keyEl = document.createElement("span");
    keyEl.className = "nm-header-key";
    keyEl.textContent = key;
    const valueEl = document.createElement("span");
    valueEl.className = "nm-header-value";
    valueEl.textContent = value;
    row.append(keyEl, valueEl);
    table.appendChild(row);
  }
  section.appendChild(table);
  return section;
}

export function findHeaderValue(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }
  const key = Object.keys(headers).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  return key ? headers[key] : undefined;
}
