import { test } from "node:test";
import assert from "node:assert/strict";
import { NetworkStore } from "./store.js";
import type { NetworkRequestEvent, NetworkResponseEvent } from "./events.js";

function requestEvent(overrides: Partial<NetworkRequestEvent> = {}): NetworkRequestEvent {
  return {
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
    timestamp: Date.now(),
    ...overrides,
  };
}

function responseEvent(overrides: Partial<NetworkResponseEvent> = {}): NetworkResponseEvent {
  return {
    type: "response",
    id: "1",
    status: 200,
    statusText: "OK",
    headers: {},
    body: undefined,
    bodyEncoding: "utf8",
    bodyTruncated: false,
    durationMs: 12,
    error: undefined,
    timestamp: Date.now(),
    ...overrides,
  };
}

test("addRequest creates a pending entry and emits an add change", () => {
  const store = new NetworkStore();
  const changes: string[] = [];
  store.onChange((change) => changes.push(change.type));

  const entry = store.addRequest(requestEvent());

  assert.equal(entry.pending, true);
  assert.equal(entry.method, "GET");
  assert.deepEqual(changes, ["add"]);
  assert.equal(store.getEntries().length, 1);
});

test("addResponse merges into the matching pending entry and emits an update change", () => {
  const store = new NetworkStore();
  store.addRequest(requestEvent());
  const changes: string[] = [];
  store.onChange((change) => changes.push(change.type));

  const updated = store.addResponse(responseEvent());

  assert.ok(updated);
  assert.equal(updated?.pending, false);
  assert.equal(updated?.status, 200);
  assert.deepEqual(changes, ["update"]);
});

test("addResponse for an unknown id is a no-op", () => {
  const store = new NetworkStore();
  const result = store.addResponse(responseEvent({ id: "missing" }));
  assert.equal(result, undefined);
  assert.equal(store.getEntries().length, 0);
});

test("clear empties the store and emits a clear change", () => {
  const store = new NetworkStore();
  store.addRequest(requestEvent());
  const changes: string[] = [];
  store.onChange((change) => changes.push(change.type));

  store.clear();

  assert.equal(store.getEntries().length, 0);
  assert.deepEqual(changes, ["clear"]);
});

test("evicts the oldest entry once maxEntries is exceeded", () => {
  const store = new NetworkStore(2);
  const evicted: string[] = [];
  store.onChange((change) => {
    if (change.type === "evict") {
      evicted.push(change.id);
    }
  });

  store.addRequest(requestEvent({ id: "a" }));
  store.addRequest(requestEvent({ id: "b" }));
  store.addRequest(requestEvent({ id: "c" }));

  assert.deepEqual(evicted, ["a"]);
  assert.deepEqual(
    store.getEntries().map((e) => e.id),
    ["b", "c"],
  );
});
