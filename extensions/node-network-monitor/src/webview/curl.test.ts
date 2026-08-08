import { test } from "node:test";
import assert from "node:assert/strict";
import type { NetworkEntry } from "@network-monitor/core";
import { buildCurlCommand } from "./curl.js";

function entry(overrides: Partial<NetworkEntry> = {}): NetworkEntry {
  return {
    id: "1",
    source: "fetch",
    processLabel: undefined,
    method: "GET",
    url: "https://example.com/api",
    requestHeaders: {},
    requestBody: undefined,
    requestBodyEncoding: "utf8",
    requestBodyTruncated: false,
    status: 200,
    statusText: "OK",
    responseHeaders: {},
    responseBody: undefined,
    responseBodyEncoding: "utf8",
    responseBodyTruncated: false,
    error: undefined,
    startedAt: Date.now(),
    durationMs: 10,
    pending: false,
    ...overrides,
  };
}

test("buildCurlCommand includes method and quoted URL", () => {
  const command = buildCurlCommand(entry({ method: "GET", url: "https://example.com/api?x=1" }));
  assert.match(command, /^curl -X GET \\\n {2}'https:\/\/example\.com\/api\?x=1'/);
});

test("buildCurlCommand adds one -H flag per header", () => {
  const command = buildCurlCommand(
    entry({ requestHeaders: { "content-type": "application/json", authorization: "[redacted]" } }),
  );
  assert.match(command, /-H 'content-type: application\/json'/);
  assert.match(command, /-H 'authorization: \[redacted\]'/);
});

test("buildCurlCommand adds --data-raw for a utf8 request body", () => {
  const command = buildCurlCommand(
    entry({ method: "POST", requestBody: '{"hello":"world"}', requestBodyEncoding: "utf8" }),
  );
  assert.match(command, /--data-raw '\{"hello":"world"\}'/);
});

test("buildCurlCommand safely escapes single quotes in the body", () => {
  const command = buildCurlCommand(
    entry({ requestBody: "it's a test", requestBodyEncoding: "utf8" }),
  );
  assert.match(command, /--data-raw 'it'\\''s a test'/);
});

test("buildCurlCommand omits --data-raw for a base64 (binary) request body", () => {
  const command = buildCurlCommand(
    entry({ requestBody: "AQIDBA==", requestBodyEncoding: "base64" }),
  );
  assert.ok(!command.includes("--data-raw"));
  assert.match(command, /# request body is binary/);
});

test("buildCurlCommand omits the data flag entirely when there is no request body", () => {
  const command = buildCurlCommand(entry({ requestBody: undefined }));
  assert.ok(!command.includes("--data-raw"));
  assert.ok(!command.includes("binary"));
});
