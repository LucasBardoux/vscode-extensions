import { EventEmitter } from "node:events";
import type { NetworkEntry, NetworkRequestEvent, NetworkResponseEvent } from "./events.js";

export const DEFAULT_MAX_ENTRIES = 500;

export type NetworkStoreChange =
  | { type: "add"; entry: NetworkEntry }
  | { type: "update"; entry: NetworkEntry }
  | { type: "evict"; id: string }
  | { type: "clear" };

export class NetworkStore {
  private readonly emitter = new EventEmitter();
  private readonly entries = new Map<string, NetworkEntry>();
  private readonly order: string[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  addRequest(event: NetworkRequestEvent): NetworkEntry {
    const entry: NetworkEntry = {
      id: event.id,
      source: event.source,
      processLabel: event.processLabel,
      method: event.method,
      url: event.url,
      requestHeaders: event.headers,
      requestBody: event.body,
      requestBodyEncoding: event.bodyEncoding,
      requestBodyTruncated: event.bodyTruncated,
      status: undefined,
      statusText: undefined,
      responseHeaders: undefined,
      responseBody: undefined,
      responseBodyEncoding: "utf8",
      responseBodyTruncated: false,
      error: undefined,
      startedAt: event.timestamp,
      durationMs: undefined,
      pending: true,
    };
    this.entries.set(entry.id, entry);
    this.order.push(entry.id);
    this.emitChange({ type: "add", entry });
    this.evictIfNeeded();
    return entry;
  }

  addResponse(event: NetworkResponseEvent): NetworkEntry | undefined {
    const existing = this.entries.get(event.id);
    if (!existing) {
      return undefined;
    }
    existing.status = event.status;
    existing.statusText = event.statusText;
    existing.responseHeaders = event.headers;
    existing.responseBody = event.body;
    existing.responseBodyEncoding = event.bodyEncoding;
    existing.responseBodyTruncated = event.bodyTruncated;
    existing.error = event.error;
    existing.durationMs = event.durationMs;
    existing.pending = false;
    this.emitChange({ type: "update", entry: existing });
    return existing;
  }

  clear(): void {
    this.entries.clear();
    this.order.length = 0;
    this.emitChange({ type: "clear" });
  }

  getEntries(): readonly NetworkEntry[] {
    const result: NetworkEntry[] = [];
    for (const id of this.order) {
      const entry = this.entries.get(id);
      if (entry !== undefined) {
        result.push(entry);
      }
    }
    return result;
  }

  onChange(listener: (change: NetworkStoreChange) => void): () => void {
    this.emitter.on("change", listener);
    return () => this.emitter.off("change", listener);
  }

  private emitChange(change: NetworkStoreChange): void {
    this.emitter.emit("change", change);
  }

  private evictIfNeeded(): void {
    while (this.order.length > this.maxEntries) {
      const id = this.order.shift();
      if (id === undefined) {
        break;
      }
      this.entries.delete(id);
      this.emitChange({ type: "evict", id });
    }
  }
}
