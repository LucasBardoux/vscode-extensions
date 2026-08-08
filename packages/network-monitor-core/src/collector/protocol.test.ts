import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLine, serializeMessage, isHelloMessage, isNetworkProtocolEvent } from "./protocol.js";

test("parseLine accepts a hello message", () => {
  const line = serializeMessage({ type: "hello", token: "abc", processLabel: undefined });
  const parsed = parseLine(line.trim());
  assert.ok(parsed && isHelloMessage(parsed));
});

test("parseLine accepts a network request event", () => {
  const line = serializeMessage({
    type: "request",
    id: "1",
    source: "fetch",
    processLabel: undefined,
    method: "GET",
    url: "http://example.com",
    headers: {},
    body: undefined,
    bodyEncoding: "utf8",
    bodyTruncated: false,
    timestamp: 0,
  });
  const parsed = parseLine(line.trim());
  assert.ok(parsed && isNetworkProtocolEvent(parsed));
});

test("parseLine returns undefined for invalid JSON", () => {
  assert.equal(parseLine("not json"), undefined);
});

test("parseLine returns undefined for well-formed JSON that isn't a known message", () => {
  assert.equal(parseLine(JSON.stringify({ foo: "bar" })), undefined);
  assert.equal(parseLine(JSON.stringify({ type: "unknown" })), undefined);
  assert.equal(parseLine(JSON.stringify(null)), undefined);
  assert.equal(parseLine(JSON.stringify("string")), undefined);
});

test("serializeMessage produces a newline-terminated JSON line", () => {
  const line = serializeMessage({ type: "hello", token: "abc", processLabel: undefined });
  assert.equal(line.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(line.trim()), { type: "hello", token: "abc" });
});
