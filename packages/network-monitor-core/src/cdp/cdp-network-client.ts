import http from "node:http";
import { EventEmitter } from "node:events";
import WebSocket, { type RawData } from "ws";
import {
  redactHeaders,
  encodeBody,
  DEFAULT_REDACTED_HEADERS,
  DEFAULT_MAX_BODY_BYTES,
} from "../redact.js";
import type { NetworkRequestEvent, NetworkResponseEvent, BodyEncoding } from "../events.js";

export interface CdpNetworkClientOptions {
  host?: string;
  port: number;
  captureBodies?: boolean;
  maxBodyBytes?: number;
  redactHeaderNames?: readonly string[];
}

interface ResolvedCdpOptions {
  host: string;
  port: number;
  captureBodies: boolean;
  maxBodyBytes: number;
  redactHeaderNames: readonly string[];
}

interface PendingRequestMeta {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | undefined;
  bodyEncoding: BodyEncoding;
  bodyTruncated: boolean;
  startedAt: number;
  status: number | undefined;
  statusText: string | undefined;
  responseHeaders: Record<string, string> | undefined;
  responseContentType: string | undefined;
}

/**
 * Connects to a Node process started with `--inspect --experimental-network-inspection`
 * and translates Chrome DevTools Protocol Network domain events into the same
 * NetworkRequestEvent/NetworkResponseEvent schema the preload tracer emits, so
 * the extension side can treat both sources identically.
 */
export class CdpNetworkClient {
  private readonly options: ResolvedCdpOptions;
  private readonly emitter = new EventEmitter();
  private readonly pendingCommands = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly requests = new Map<string, PendingRequestMeta>();
  private ws: WebSocket | undefined;
  private nextMessageId = 1;

  constructor(options: CdpNetworkClientOptions) {
    this.options = {
      host: options.host ?? "127.0.0.1",
      port: options.port,
      captureBodies: options.captureBodies ?? true,
      maxBodyBytes: options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
      redactHeaderNames: options.redactHeaderNames ?? DEFAULT_REDACTED_HEADERS,
    };
  }

  async connect(): Promise<void> {
    const webSocketDebuggerUrl = await this.discoverWebSocketUrl();
    const ws = new WebSocket(webSocketDebuggerUrl);

    await new Promise<void>((resolve, reject) => {
      const onOpen = (): void => {
        ws.off("error", onError);
        resolve();
      };
      const onError = (error: Error): void => {
        ws.off("open", onOpen);
        reject(error);
      };
      ws.once("open", onOpen);
      ws.once("error", onError);
    });

    ws.on("message", (data: RawData) => this.handleMessage(data));
    this.ws = ws;
    await this.sendCommand("Network.enable", {});
  }

  close(): void {
    this.ws?.close();
    this.ws = undefined;
    this.requests.clear();
  }

  onRequest(listener: (event: NetworkRequestEvent) => void): () => void {
    this.emitter.on("request", listener);
    return () => {
      this.emitter.off("request", listener);
    };
  }

  onResponse(listener: (event: NetworkResponseEvent) => void): () => void {
    this.emitter.on("response", listener);
    return () => {
      this.emitter.off("response", listener);
    };
  }

  private async discoverWebSocketUrl(): Promise<string> {
    const targets = await fetchJson<unknown[]>(
      `http://${this.options.host}:${this.options.port}/json/list`,
    );
    for (const target of targets) {
      if (isRecord(target) && typeof target.webSocketDebuggerUrl === "string") {
        return target.webSocketDebuggerUrl;
      }
    }
    throw new Error(`No inspectable target found at ${this.options.host}:${this.options.port}`);
  }

  private sendCommand(method: string, params: Record<string, unknown>): Promise<unknown> {
    const ws = this.ws;
    if (!ws) {
      return Promise.reject(new Error("CdpNetworkClient is not connected"));
    }
    const id = this.nextMessageId++;
    return new Promise((resolve, reject) => {
      this.pendingCommands.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  private handleMessage(data: RawData): void {
    let message: unknown;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!isRecord(message)) {
      return;
    }

    if (typeof message.id === "number") {
      const pending = this.pendingCommands.get(message.id);
      if (!pending) {
        return;
      }
      this.pendingCommands.delete(message.id);
      if (isRecord(message.error)) {
        pending.reject(new Error(String(message.error.message ?? "CDP command failed")));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (typeof message.method === "string") {
      this.handleEvent(message.method, isRecord(message.params) ? message.params : {});
    }
  }

  private handleEvent(method: string, params: Record<string, unknown>): void {
    switch (method) {
      case "Network.requestWillBeSent":
        this.onRequestWillBeSent(params);
        break;
      case "Network.responseReceived":
        this.onResponseReceived(params);
        break;
      case "Network.loadingFinished":
        void this.onLoadingFinished(params);
        break;
      case "Network.loadingFailed":
        this.onLoadingFailed(params);
        break;
      default:
        break;
    }
  }

  private onRequestWillBeSent(params: Record<string, unknown>): void {
    const requestId = params.requestId;
    const request = params.request;
    if (typeof requestId !== "string" || !isRecord(request)) {
      return;
    }

    const rawHeaders = isRecord(request.headers) ? (request.headers as Record<string, string>) : {};
    const headers = redactHeaders(rawHeaders, this.options.redactHeaderNames);
    const postData = typeof request.postData === "string" ? request.postData : undefined;

    let body: string | undefined;
    let bodyEncoding: BodyEncoding = "utf8";
    let bodyTruncated = false;
    if (this.options.captureBodies && postData !== undefined) {
      const contentType = firstHeaderValue(rawHeaders, "content-type");
      const encoded = encodeBody(postData, this.options.maxBodyBytes, contentType);
      body = encoded.text;
      bodyEncoding = encoded.encoding;
      bodyTruncated = encoded.truncated;
    }

    const startedAt = Date.now();
    this.requests.set(requestId, {
      method: typeof request.method === "string" ? request.method : "GET",
      url: typeof request.url === "string" ? request.url : "",
      headers,
      body,
      bodyEncoding,
      bodyTruncated,
      startedAt,
      status: undefined,
      statusText: undefined,
      responseHeaders: undefined,
      responseContentType: undefined,
    });

    this.emitter.emit("request", {
      type: "request",
      id: requestId,
      source: "cdp",
      processLabel: undefined,
      method: typeof request.method === "string" ? request.method : "GET",
      url: typeof request.url === "string" ? request.url : "",
      headers,
      body,
      bodyEncoding,
      bodyTruncated,
      timestamp: startedAt,
    } satisfies NetworkRequestEvent);
  }

  private onResponseReceived(params: Record<string, unknown>): void {
    const requestId = params.requestId;
    const response = params.response;
    const meta = typeof requestId === "string" ? this.requests.get(requestId) : undefined;
    if (!meta || !isRecord(response)) {
      return;
    }
    meta.status = typeof response.status === "number" ? response.status : undefined;
    meta.statusText = typeof response.statusText === "string" ? response.statusText : undefined;
    const rawResponseHeaders = isRecord(response.headers)
      ? (response.headers as Record<string, string>)
      : undefined;
    meta.responseHeaders = rawResponseHeaders
      ? redactHeaders(rawResponseHeaders, this.options.redactHeaderNames)
      : undefined;
    meta.responseContentType = rawResponseHeaders
      ? firstHeaderValue(rawResponseHeaders, "content-type")
      : undefined;
  }

  private async onLoadingFinished(params: Record<string, unknown>): Promise<void> {
    const requestId = params.requestId;
    if (typeof requestId !== "string") {
      return;
    }
    const meta = this.requests.get(requestId);
    if (!meta) {
      return;
    }
    this.requests.delete(requestId);

    let body: string | undefined;
    let bodyEncoding: BodyEncoding = "utf8";
    let bodyTruncated = false;
    if (this.options.captureBodies) {
      const fetched = await this.tryGetResponseBody(requestId);
      if (fetched !== undefined) {
        const encoded = encodeBody(fetched, this.options.maxBodyBytes, meta.responseContentType);
        body = encoded.text;
        bodyEncoding = encoded.encoding;
        bodyTruncated = encoded.truncated;
      }
    }

    this.emitter.emit("response", {
      type: "response",
      id: requestId,
      status: meta.status,
      statusText: meta.statusText,
      headers: meta.responseHeaders,
      body,
      bodyEncoding,
      bodyTruncated,
      durationMs: Date.now() - meta.startedAt,
      error: undefined,
      timestamp: Date.now(),
    } satisfies NetworkResponseEvent);
  }

  private onLoadingFailed(params: Record<string, unknown>): void {
    const requestId = params.requestId;
    if (typeof requestId !== "string") {
      return;
    }
    const meta = this.requests.get(requestId);
    if (!meta) {
      return;
    }
    this.requests.delete(requestId);

    this.emitter.emit("response", {
      type: "response",
      id: requestId,
      status: meta.status,
      statusText: meta.statusText,
      headers: meta.responseHeaders,
      body: undefined,
      bodyEncoding: "utf8",
      bodyTruncated: false,
      durationMs: Date.now() - meta.startedAt,
      error: typeof params.errorText === "string" ? params.errorText : "Request failed",
      timestamp: Date.now(),
    } satisfies NetworkResponseEvent);
  }

  /**
   * Returns the raw response bytes regardless of how CDP transported them, so
   * the caller can make its own text-vs-binary call via encodeBody() based on
   * content-type (consistent with the preload tracer's http/fetch paths)
   * instead of trusting CDP's base64Encoded flag as the final word.
   */
  private async tryGetResponseBody(requestId: string): Promise<Buffer | undefined> {
    try {
      const result = await this.sendCommand("Network.getResponseBody", { requestId });
      if (!isRecord(result) || typeof result.body !== "string") {
        return undefined;
      }
      return result.base64Encoded === true
        ? Buffer.from(result.body, "base64")
        : Buffer.from(result.body, "utf8");
    } catch {
      return undefined;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstHeaderValue(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        res.setEncoding("utf8");
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      })
      .on("error", reject);
  });
}
