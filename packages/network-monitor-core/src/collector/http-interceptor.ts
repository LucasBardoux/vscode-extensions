import http from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";
import { redactHeaders, encodeBody } from "../redact.js";
import type { BodyEncoding } from "../events.js";
import type { TracerConfig } from "./tracer-config.js";

type RequestFn = typeof http.request;

/**
 * Patches `http.request`/`http.get` and `https.request`/`https.get` so every
 * outgoing core-module request is captured. Returns an uninstall function
 * that restores the originals.
 */
export function installHttpInterceptor(config: TracerConfig): () => void {
  const restoreHttp = patchModule(http, config);
  const restoreHttps = patchModule(https, config);
  return () => {
    restoreHttp();
    restoreHttps();
  };
}

function patchModule(mod: typeof http | typeof https, config: TracerConfig): () => void {
  const originalRequest = mod.request;
  const originalGet = mod.get;

  mod.request = wrapRequestFn(originalRequest, config);
  mod.get = wrapRequestFn(originalGet, config);

  return () => {
    mod.request = originalRequest;
    mod.get = originalGet;
  };
}

function wrapRequestFn(original: RequestFn, config: TracerConfig): RequestFn {
  // Node's http.request/http.get have many overloads (url | options, optional
  // options, optional callback). Re-typing a pass-through wrapper against all
  // of them isn't practical, so we forward args untyped and cast the result.
  const wrapped = (...args: unknown[]): http.ClientRequest => {
    const req = (original as (...forwardedArgs: unknown[]) => http.ClientRequest)(...args);
    instrumentClientRequest(req, config);
    return req;
  };
  return wrapped as RequestFn;
}

function instrumentClientRequest(req: http.ClientRequest, config: TracerConfig): void {
  const id = randomUUID();
  const startedAt = Date.now();
  const bodyChunks: Buffer[] = [];
  let requestEmitted = false;

  const emitRequestOnce = (): void => {
    if (requestEmitted) {
      return;
    }
    requestEmitted = true;

    let body: string | undefined;
    let bodyEncoding: BodyEncoding = "utf8";
    let bodyTruncated = false;
    if (config.captureBodies && bodyChunks.length > 0) {
      const contentType = firstHeaderValue(req.getHeader("content-type"));
      const encoded = encodeBody(Buffer.concat(bodyChunks), config.maxBodyBytes, contentType);
      body = encoded.text;
      bodyEncoding = encoded.encoding;
      bodyTruncated = encoded.truncated;
    }

    // req.host is hostname-only on Node's ClientRequest; the "Host" header
    // (which Node sets automatically) is the only place the port survives.
    const host = firstHeaderValue(req.getHeader("host")) ?? req.host;

    config.emit({
      type: "request",
      id,
      source: "http",
      processLabel: undefined,
      method: req.method,
      url: `${req.protocol}//${host}${req.path}`,
      headers: redactHeaders(flattenHeaders(req.getHeaders()), config.redactHeaderNames),
      body,
      bodyEncoding,
      bodyTruncated,
      timestamp: startedAt,
    });
  };

  const originalWrite = req.write.bind(req);
  req.write = ((chunk: unknown, ...rest: unknown[]) => {
    if (config.captureBodies && chunk) {
      bodyChunks.push(toBuffer(chunk));
    }
    return (originalWrite as (...forwardedArgs: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof req.write;

  const originalEnd = req.end.bind(req);
  req.end = ((chunk?: unknown, ...rest: unknown[]) => {
    if (config.captureBodies && chunk && typeof chunk !== "function") {
      bodyChunks.push(toBuffer(chunk));
    }
    emitRequestOnce();
    return (originalEnd as (...forwardedArgs: unknown[]) => http.ClientRequest)(chunk, ...rest);
  }) as typeof req.end;

  req.on("response", (res: http.IncomingMessage) => {
    emitRequestOnce();
    const responseChunks: Buffer[] = [];
    if (config.captureBodies) {
      res.on("data", (chunk: Buffer) => responseChunks.push(chunk));
    }
    res.on("end", () => {
      let body: string | undefined;
      let bodyEncoding: BodyEncoding = "utf8";
      let bodyTruncated = false;
      if (config.captureBodies && responseChunks.length > 0) {
        const contentType = firstHeaderValue(res.headers["content-type"]);
        const encoded = encodeBody(Buffer.concat(responseChunks), config.maxBodyBytes, contentType);
        body = encoded.text;
        bodyEncoding = encoded.encoding;
        bodyTruncated = encoded.truncated;
      }
      config.emit({
        type: "response",
        id,
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: redactHeaders(flattenHeaders(res.headers), config.redactHeaderNames),
        body,
        bodyEncoding,
        bodyTruncated,
        durationMs: Date.now() - startedAt,
        error: undefined,
        timestamp: Date.now(),
      });
    });
  });

  req.on("error", (error: Error) => {
    emitRequestOnce();
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
      error: error.message,
      timestamp: Date.now(),
    });
  });
}

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }
  return Buffer.from(String(chunk));
}

function firstHeaderValue(value: string | string[] | number | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value === undefined ? undefined : String(value);
}

function flattenHeaders(
  headers: http.OutgoingHttpHeaders | http.IncomingHttpHeaders,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    result[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return result;
}
