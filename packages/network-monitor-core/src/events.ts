export type NetworkEventSource = "http" | "fetch" | "cdp";
export type BodyEncoding = "utf8" | "base64";

export interface NetworkRequestEvent {
  type: "request";
  id: string;
  source: NetworkEventSource;
  processLabel: string | undefined;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | undefined;
  bodyEncoding: BodyEncoding;
  bodyTruncated: boolean;
  timestamp: number;
}

export interface NetworkResponseEvent {
  type: "response";
  id: string;
  status: number | undefined;
  statusText: string | undefined;
  headers: Record<string, string> | undefined;
  body: string | undefined;
  bodyEncoding: BodyEncoding;
  bodyTruncated: boolean;
  durationMs: number;
  error: string | undefined;
  timestamp: number;
}

export type NetworkProtocolEvent = NetworkRequestEvent | NetworkResponseEvent;

export interface NetworkEntry {
  id: string;
  source: NetworkEventSource;
  processLabel: string | undefined;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | undefined;
  requestBodyEncoding: BodyEncoding;
  requestBodyTruncated: boolean;
  status: number | undefined;
  statusText: string | undefined;
  responseHeaders: Record<string, string> | undefined;
  responseBody: string | undefined;
  responseBodyEncoding: BodyEncoding;
  responseBodyTruncated: boolean;
  error: string | undefined;
  startedAt: number;
  durationMs: number | undefined;
  pending: boolean;
}

export function isNetworkRequestEvent(event: NetworkProtocolEvent): event is NetworkRequestEvent {
  return event.type === "request";
}

export function isNetworkResponseEvent(event: NetworkProtocolEvent): event is NetworkResponseEvent {
  return event.type === "response";
}
