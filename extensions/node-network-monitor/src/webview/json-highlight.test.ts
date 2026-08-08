import { test } from "node:test";
import assert from "node:assert/strict";
import { tryFormatJson, highlightJson, escapeHtml } from "./json-highlight.js";

test("tryFormatJson pretty-prints valid JSON", () => {
  assert.equal(
    tryFormatJson('{"a":1,"b":[true,null]}'),
    '{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}',
  );
});

test("tryFormatJson returns undefined for invalid JSON", () => {
  assert.equal(tryFormatJson("not json"), undefined);
  assert.equal(tryFormatJson("<html></html>"), undefined);
  assert.equal(tryFormatJson(""), undefined);
  assert.equal(tryFormatJson("   "), undefined);
});

test("tryFormatJson accepts JSON primitives, not just objects/arrays", () => {
  assert.equal(tryFormatJson("42"), "42");
  assert.equal(tryFormatJson('"hello"'), '"hello"');
  assert.equal(tryFormatJson("true"), "true");
});

test("highlightJson wraps keys, strings, numbers, booleans, and null in token spans", () => {
  const pretty = tryFormatJson('{"name":"Ada","age":36,"active":true,"note":null}');
  assert.ok(pretty);
  const html = highlightJson(pretty);
  assert.match(html, /<span class="tok-key">"name":<\/span>/);
  assert.match(html, /<span class="tok-string">"Ada"<\/span>/);
  assert.match(html, /<span class="tok-number">36<\/span>/);
  assert.match(html, /<span class="tok-boolean">true<\/span>/);
  assert.match(html, /<span class="tok-null">null<\/span>/);
});

test("highlightJson escapes HTML-significant characters in string values", () => {
  const pretty = tryFormatJson('{"html":"<script>alert(1)</script>"}');
  assert.ok(pretty);
  const html = highlightJson(pretty);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("escapeHtml escapes ampersands and angle brackets only", () => {
  assert.equal(escapeHtml('<a href="x">A & B</a>'), '&lt;a href="x"&gt;A &amp; B&lt;/a&gt;');
});
