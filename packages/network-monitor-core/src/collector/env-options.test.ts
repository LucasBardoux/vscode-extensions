import { test } from "node:test";
import assert from "node:assert/strict";
import { readTracerOptionsFromEnv, buildTracerEnv } from "./env-options.js";

test("returns undefined when NETMON_PORT/NETMON_TOKEN are not set", () => {
  assert.equal(readTracerOptionsFromEnv({}), undefined);
  assert.equal(readTracerOptionsFromEnv({ NETMON_PORT: "1234" }), undefined);
  assert.equal(readTracerOptionsFromEnv({ NETMON_TOKEN: "abc" }), undefined);
});

test("returns undefined when NETMON_PORT is not a finite number", () => {
  assert.equal(
    readTracerOptionsFromEnv({ NETMON_PORT: "not-a-number", NETMON_TOKEN: "abc" }),
    undefined,
  );
});

test("parses the minimal required options", () => {
  const options = readTracerOptionsFromEnv({ NETMON_PORT: "1234", NETMON_TOKEN: "abc" });
  assert.deepEqual(options, { port: 1234, token: "abc" });
});

test("parses optional fields when present", () => {
  const options = readTracerOptionsFromEnv({
    NETMON_PORT: "1234",
    NETMON_TOKEN: "abc",
    NETMON_PROCESS_LABEL: "backend",
    NETMON_CAPTURE_BODIES: "0",
    NETMON_MAX_BODY_BYTES: "5000",
    NETMON_REDACT_HEADERS: "authorization, x-custom ,,cookie",
  });
  assert.deepEqual(options, {
    port: 1234,
    token: "abc",
    processLabel: "backend",
    captureBodies: false,
    maxBodyBytes: 5000,
    redactHeaderNames: ["authorization", "x-custom", "cookie"],
  });
});

test("NETMON_CAPTURE_BODIES=1 maps to captureBodies true", () => {
  const options = readTracerOptionsFromEnv({
    NETMON_PORT: "1234",
    NETMON_TOKEN: "abc",
    NETMON_CAPTURE_BODIES: "1",
  });
  assert.equal(options?.captureBodies, true);
});

test("buildTracerEnv and readTracerOptionsFromEnv round-trip", () => {
  const env = buildTracerEnv({
    port: 4321,
    token: "xyz",
    processLabel: "backend",
    captureBodies: false,
    maxBodyBytes: 2000,
    redactHeaderNames: ["authorization", "cookie"],
  });
  const options = readTracerOptionsFromEnv(env);
  assert.deepEqual(options, {
    port: 4321,
    token: "xyz",
    processLabel: "backend",
    captureBodies: false,
    maxBodyBytes: 2000,
    redactHeaderNames: ["authorization", "cookie"],
  });
});

test("buildTracerEnv only sets the minimal keys when optional fields are absent", () => {
  const env = buildTracerEnv({ port: 4321, token: "xyz" });
  assert.deepEqual(env, { NETMON_PORT: "4321", NETMON_TOKEN: "xyz" });
});
