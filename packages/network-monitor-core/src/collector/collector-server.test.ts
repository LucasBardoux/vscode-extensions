import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { once } from "node:events";
import { CollectorServer } from "./collector-server.js";
import { serializeMessage } from "./protocol.js";
import type { NetworkRequestEvent, NetworkResponseEvent } from "../events.js";

function requestEvent(): NetworkRequestEvent {
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
  };
}

function responseEvent(): NetworkResponseEvent {
  return {
    type: "response",
    id: "1",
    status: 200,
    statusText: "OK",
    headers: {},
    body: undefined,
    bodyEncoding: "utf8",
    bodyTruncated: false,
    durationMs: 5,
    error: undefined,
    timestamp: Date.now(),
  };
}

test("accepts an authenticated client and forwards request/response events", async () => {
  const server = new CollectorServer();
  const { port, token } = await server.start();

  const received: string[] = [];
  server.onRequest(() => received.push("request"));
  server.onResponse(() => received.push("response"));

  const socket = net.connect(port, "127.0.0.1");
  await once(socket, "connect");
  socket.write(serializeMessage({ type: "hello", token, processLabel: undefined }));
  socket.write(serializeMessage(requestEvent()));
  socket.write(serializeMessage(responseEvent()));

  await waitUntil(() => received.length === 2);

  assert.deepEqual(received, ["request", "response"]);

  socket.destroy();
  await server.stop();
});

test("destroys the connection when the hello token is wrong", async () => {
  const server = new CollectorServer();
  const { port } = await server.start();

  const authFailures: string[] = [];
  server.onAuthFailure((reason) => authFailures.push(reason));

  const socket = net.connect(port, "127.0.0.1");
  await once(socket, "connect");
  socket.write(serializeMessage({ type: "hello", token: "wrong-token", processLabel: undefined }));

  await once(socket, "close");

  assert.deepEqual(authFailures, ["token mismatch"]);

  await server.stop();
});

test("emits a connection event with the processLabel once a client authenticates", async () => {
  const server = new CollectorServer();
  const { port, token } = await server.start();

  const connections: (string | undefined)[] = [];
  server.onConnection((info) => connections.push(info.processLabel));

  const socket = net.connect(port, "127.0.0.1");
  await once(socket, "connect");
  socket.write(serializeMessage({ type: "hello", token, processLabel: "my-backend" }));

  await waitUntil(() => connections.length === 1);
  assert.deepEqual(connections, ["my-backend"]);

  socket.destroy();
  await server.stop();
});

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
