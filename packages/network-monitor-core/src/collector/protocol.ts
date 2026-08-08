import type { NetworkProtocolEvent } from "../events.js";

/**
 * Wire protocol between a tracer running inside the monitored process and the
 * CollectorServer running in the extension host: one newline-delimited JSON
 * message per line over a plain TCP socket. The first line must be a
 * HelloMessage carrying the shared token; every line after that is a
 * NetworkProtocolEvent.
 */
export interface HelloMessage {
  type: "hello";
  token: string;
  processLabel: string | undefined;
}

export type ProtocolMessage = HelloMessage | NetworkProtocolEvent;

export function isHelloMessage(value: unknown): value is HelloMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "hello" &&
    typeof (value as { token?: unknown }).token === "string"
  );
}

export function isNetworkProtocolEvent(value: unknown): value is NetworkProtocolEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return type === "request" || type === "response";
}

export function parseLine(line: string): ProtocolMessage | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (isHelloMessage(parsed) || isNetworkProtocolEvent(parsed)) {
    return parsed;
  }
  return undefined;
}

export function serializeMessage(message: ProtocolMessage): string {
  return JSON.stringify(message) + "\n";
}
