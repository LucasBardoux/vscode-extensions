import { test } from "node:test";
import assert from "node:assert/strict";
import { tryFormatXml, highlightXml } from "./xml-highlight.js";

test("tryFormatXml indents nested elements", () => {
  const pretty = tryFormatXml("<root><a>1</a><b><c>2</c></b></root>");
  assert.equal(pretty, "<root>\n  <a>1</a>\n  <b>\n    <c>2</c>\n  </b>\n</root>");
});

test("tryFormatXml returns undefined for non-XML text", () => {
  assert.equal(tryFormatXml("not xml"), undefined);
  assert.equal(tryFormatXml('{"a":1}'), undefined);
  assert.equal(tryFormatXml(""), undefined);
});

test("tryFormatXml returns undefined for malformed XML", () => {
  assert.equal(tryFormatXml("<root><a></root>"), undefined);
});

test("tryFormatXml handles a leading XML declaration", () => {
  const pretty = tryFormatXml('<?xml version="1.0"?><root><a>1</a></root>');
  assert.ok(pretty?.startsWith('<?xml version="1.0"?>'));
  assert.match(pretty ?? "", /<root>\n\s+<a>1<\/a>\n<\/root>/);
});

test("highlightXml wraps tag names and attribute name/value pairs", () => {
  const pretty = tryFormatXml('<root id="1"><item name="x">text</item></root>');
  assert.ok(pretty);
  const html = highlightXml(pretty);
  assert.match(html, /<span class="tok-tag">root<\/span>/);
  assert.match(html, /<span class="tok-attr-name">id<\/span>=<span class="tok-string">"1"<\/span>/);
  assert.match(html, /<span class="tok-tag">item<\/span>/);
});

test("highlightXml escapes HTML-significant characters outside of tags", () => {
  const pretty = tryFormatXml("<root><note>A &amp; B</note></root>");
  assert.ok(pretty);
  const html = highlightXml(pretty);
  assert.match(html, /A &amp;amp; B/);
});
