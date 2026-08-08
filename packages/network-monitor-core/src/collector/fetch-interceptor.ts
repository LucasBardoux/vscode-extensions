import { randomUUID } from "node:crypto";
import { redactHeaders, encodeBody } from "../redact.js";
import type { TracerConfig } from "./tracer-config.js";

/**
 * Patches the global `fetch` (built on undici) so every call is captured.
 * Returns an uninstall function that restores the original `fetch`.
 */
export function installFetchInterceptor(config: TracerConfig): () => void {
  const target = globalThis as typeof globalThis & { fetch?: typeof fetch };
  const originalFetch = target.fetch;
  if (typeof originalFetch !== "function") {
    return () => {};
  }

  const patchedFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const id = randomUUID();
    const startedAt = Date.now();
    const snapshot = buildRequestSnapshot(input, init);
    const headers = redactHeaders(snapshot.headers, config.redactHeaderNames);

    let requestBody: string | undefined;
    let requestBodyEncoding: "utf8" | "base64" = "utf8";
    let requestBodyTruncated = false;
    if (config.captureBodies && snapshot.body !== undefined) {
      const encoded = encodeBody(
        snapshot.body,
        config.maxBodyBytes,
        snapshot.headers["content-type"],
      );
      requestBody = encoded.text;
      requestBodyEncoding = encoded.encoding;
      requestBodyTruncated = encoded.truncated;
    }

    config.emit({
      type: "request",
      id,
      source: "fetch",
      processLabel: undefined,
      method: snapshot.method,
      url: snapshot.url,
      headers,
      body: requestBody,
      bodyEncoding: requestBodyEncoding,
      bodyTruncated: requestBodyTruncated,
      timestamp: startedAt,
    });

    try {
      const response = await originalFetch(input, init);
      void reportResponse(config, id, startedAt, response);
      return response;
    } catch (error) {
      config.emit({
        type: "response",
        id,
        status: undefined,
        statusText: undefined,
        headers: undefined,
        body: undefined,
        bodyEncoding: "utf8",
        bodyTruncated: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      throw error;
    }
  };

  target.fetch = patchedFetch as typeof fetch;
  return () => {
    target.fetch = originalFetch;
  };
}

async function reportResponse(
  config: TracerConfig,
  id: string,
  startedAt: number,
  response: Response,
): Promise<void> {
  const rawHeaders = Object.fromEntries(response.headers);
  const headers = redactHeaders(rawHeaders, config.redactHeaderNames);
  let body: string | undefined;
  let bodyEncoding: "utf8" | "base64" = "utf8";
  let bodyTruncated = false;

  if (config.captureBodies) {
    try {
      const buffer = Buffer.from(await response.clone().arrayBuffer());
      const encoded = encodeBody(buffer, config.maxBodyBytes, rawHeaders["content-type"]);
      body = encoded.text;
      bodyEncoding = encoded.encoding;
      bodyTruncated = encoded.truncated;
    } catch {
      // Body not readable (e.g. opaque/redirect responses) — report without a body.
    }
  }

  config.emit({
    type: "response",
    id,
    status: response.status,
    statusText: response.statusText,
    headers,
    body,
    bodyEncoding,
    bodyTruncated,
    durationMs: Date.now() - startedAt,
    error: undefined,
    timestamp: Date.now(),
  });
}

interface RequestSnapshot {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Buffer | undefined;
}

function buildRequestSnapshot(
  input: string | URL | Request,
  init: RequestInit | undefined,
): RequestSnapshot {
  const isRequestInput = typeof Request !== "undefined" && input instanceof Request;
  const url = isRequestInput ? input.url : input instanceof URL ? input.toString() : String(input);
  const method = init?.method ?? (isRequestInput ? input.method : "GET");

  const headers = new Headers(isRequestInput ? input.headers : undefined);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  let body: Buffer | undefined;
  const initBody = init?.body;
  if (typeof initBody === "string") {
    body = Buffer.from(initBody, "utf8");
  } else if (initBody instanceof Uint8Array) {
    body = Buffer.from(initBody);
  } else if (initBody instanceof URLSearchParams) {
    body = Buffer.from(initBody.toString(), "utf8");
  }

  return { method, url, headers: Object.fromEntries(headers), body };
}
