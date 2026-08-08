import { test } from "node:test";
import assert from "node:assert/strict";
import {
  redactHeaders,
  encodeBody,
  isTextContentType,
  DEFAULT_REDACTED_HEADERS,
  DEFAULT_MAX_BODY_BYTES,
} from "./redact.js";

test("redactHeaders masks default sensitive headers case-insensitively", () => {
  const result = redactHeaders({
    Authorization: "Bearer secret",
    "Content-Type": "application/json",
    Cookie: "session=abc",
  });
  assert.equal(result.Authorization, "[redacted]");
  assert.equal(result["Content-Type"], "application/json");
  assert.equal(result.Cookie, "[redacted]");
});

test("redactHeaders respects a custom redaction list", () => {
  const result = redactHeaders({ "X-Custom-Secret": "value", Authorization: "Bearer secret" }, [
    "x-custom-secret",
  ]);
  assert.equal(result["X-Custom-Secret"], "[redacted]");
  assert.equal(result.Authorization, "Bearer secret");
});

test("DEFAULT_REDACTED_HEADERS covers common sensitive headers", () => {
  assert.deepEqual(
    [...DEFAULT_REDACTED_HEADERS].sort(),
    ["authorization", "cookie", "proxy-authorization", "set-cookie", "x-api-key"].sort(),
  );
});

test("isTextContentType recognizes common text-like MIME types", () => {
  assert.equal(isTextContentType("application/json"), true);
  assert.equal(isTextContentType("application/json; charset=utf-8"), true);
  assert.equal(isTextContentType("text/html"), true);
  assert.equal(isTextContentType("text/plain"), true);
  assert.equal(isTextContentType("application/xml"), true);
  assert.equal(isTextContentType("application/vnd.api+json"), true);
  assert.equal(isTextContentType("application/x-www-form-urlencoded"), true);
  assert.equal(isTextContentType(undefined), true);
});

test("isTextContentType flags binary MIME types", () => {
  assert.equal(isTextContentType("image/png"), false);
  assert.equal(isTextContentType("image/jpeg"), false);
  assert.equal(isTextContentType("application/octet-stream"), false);
  assert.equal(isTextContentType("font/woff2"), false);
  assert.equal(isTextContentType("application/pdf"), false);
  assert.equal(isTextContentType("image/svg+xml"), false);
});

test("encodeBody keeps short text bodies untouched as utf8", () => {
  const result = encodeBody("hello world", 100, "text/plain");
  assert.equal(result.text, "hello world");
  assert.equal(result.encoding, "utf8");
  assert.equal(result.truncated, false);
});

test("encodeBody truncates text bodies exceeding maxBytes", () => {
  const result = encodeBody("hello world", 5, "text/plain");
  assert.equal(result.text, "hello");
  assert.equal(result.truncated, true);
});

test("encodeBody accepts Buffer input", () => {
  const result = encodeBody(Buffer.from("hello world"), 5, "text/plain");
  assert.equal(result.text, "hello");
  assert.equal(result.truncated, true);
});

test("encodeBody defaults to utf8 when content type is missing", () => {
  const result = encodeBody("plain text", 100, undefined);
  assert.equal(result.encoding, "utf8");
  assert.equal(result.text, "plain text");
});

test("encodeBody base64-encodes binary content types", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = encodeBody(png, 100, "image/png");
  assert.equal(result.encoding, "base64");
  assert.equal(result.text, png.toString("base64"));
  assert.equal(Buffer.from(result.text, "base64").equals(png), true);
});

test("DEFAULT_MAX_BODY_BYTES is a sane default", () => {
  assert.equal(DEFAULT_MAX_BODY_BYTES, 2_000_000);
});
