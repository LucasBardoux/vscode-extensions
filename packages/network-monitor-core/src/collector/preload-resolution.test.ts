import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  detectModuleType,
  getPreloadPath,
  resolvePreload,
  appendNodeOptions,
} from "./preload-resolution.js";

test("getPreloadPath points at real, existing compiled files", () => {
  const cjsPath = getPreloadPath("commonjs");
  const mjsPath = getPreloadPath("module");
  assert.ok(cjsPath.endsWith("tracer-preload.cjs"));
  assert.ok(mjsPath.endsWith("tracer-preload.mjs"));
  assert.ok(fs.existsSync(cjsPath), `expected ${cjsPath} to exist`);
  assert.ok(fs.existsSync(mjsPath), `expected ${mjsPath} to exist`);
});

test("detectModuleType returns commonjs when no package.json is found", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "netmon-test-"));
  try {
    assert.equal(detectModuleType(path.join(dir, "index.js")), "commonjs");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("detectModuleType detects an ESM package.json in a parent directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "netmon-test-"));
  try {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module" }));
    const nested = path.join(dir, "src", "index.js");
    fs.mkdirSync(path.dirname(nested), { recursive: true });
    assert.equal(detectModuleType(nested), "module");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("detectModuleType defaults to commonjs when package.json has no type field", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "netmon-test-"));
  try {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }));
    assert.equal(detectModuleType(path.join(dir, "index.js")), "commonjs");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolvePreload picks --import for ESM and --require for CommonJS", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "netmon-test-"));
  try {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module" }));
    const esm = resolvePreload(path.join(dir, "index.js"));
    assert.equal(esm.flag, "--import");
    assert.ok(esm.path.endsWith("tracer-preload.mjs"));

    const cjs = resolvePreload(undefined);
    assert.equal(cjs.flag, "--require");
    assert.ok(cjs.path.endsWith("tracer-preload.cjs"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("appendNodeOptions quotes paths containing spaces and preserves existing options", () => {
  const withSpace = appendNodeOptions("--max-old-space-size=4096", {
    flag: "--require",
    path: "C:/Program Files/preload.cjs",
  });
  assert.equal(withSpace, '--max-old-space-size=4096 --require "C:/Program Files/preload.cjs"');

  const withEmptyExisting = appendNodeOptions("   ", {
    flag: "--require",
    path: "/tmp/preload.cjs",
  });
  assert.equal(withEmptyExisting, "--require /tmp/preload.cjs");
});

test("appendNodeOptions converts --import targets to a file:// URL (required by the ESM loader on Windows)", () => {
  const rawPath = path.join(os.tmpdir(), "preload dir", "preload.mjs");
  const result = appendNodeOptions(undefined, { flag: "--import", path: rawPath });
  const expectedUrl = pathToFileURL(rawPath).href;
  assert.equal(result, `--import ${quoteIfContainsSpace(expectedUrl)}`);
});

function quoteIfContainsSpace(value: string): string {
  return value.includes(" ") ? `"${value}"` : value;
}
