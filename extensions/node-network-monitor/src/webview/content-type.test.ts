import { test } from "node:test";
import assert from "node:assert/strict";
import { shortContentTypeLabel } from "./content-type.js";

test("shortContentTypeLabel recognizes common types", () => {
  assert.equal(shortContentTypeLabel("application/json"), "json");
  assert.equal(shortContentTypeLabel("application/json; charset=utf-8"), "json");
  assert.equal(shortContentTypeLabel("application/vnd.api+json"), "json");
  assert.equal(shortContentTypeLabel("text/html"), "html");
  assert.equal(shortContentTypeLabel("text/css"), "css");
  assert.equal(shortContentTypeLabel("application/javascript"), "js");
  assert.equal(shortContentTypeLabel("text/javascript"), "js");
  assert.equal(shortContentTypeLabel("text/plain"), "text");
  assert.equal(shortContentTypeLabel("image/png"), "png");
  assert.equal(shortContentTypeLabel("image/jpeg"), "jpeg");
  assert.equal(shortContentTypeLabel("font/woff2"), "font");
  assert.equal(shortContentTypeLabel("application/xml"), "xml");
});

test("shortContentTypeLabel handles missing or empty content types", () => {
  assert.equal(shortContentTypeLabel(undefined), "");
  assert.equal(shortContentTypeLabel(""), "");
});

test("shortContentTypeLabel falls back to a truncated subtype for unknown types", () => {
  assert.equal(shortContentTypeLabel("application/octet-stream"), "octet-stream");
  assert.equal(shortContentTypeLabel("application/x-really-long-custom-subtype"), "x-really-lon");
});
