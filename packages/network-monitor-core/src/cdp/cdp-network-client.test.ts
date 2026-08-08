import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { WebSocketServer } from "ws";
import { CdpNetworkClient } from "./cdp-network-client.js";
import { NetworkStore } from "../store.js";

test("translates CDP Network domain events into a completed store entry", async () => {
  let wsPort = 0;

  const httpServer = http.createServer((req, res) => {
    if (req.url === "/json/list") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify([{ webSocketDebuggerUrl: `ws://127.0.0.1:${wsPort}/target` }]));
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", (socket) => {
    socket.on("message", (raw: Buffer) => {
      const message = JSON.parse(raw.toString()) as {
        id?: number;
        method?: string;
        params?: unknown;
      };
      if (message.method === "Network.enable") {
        socket.send(JSON.stringify({ id: message.id, result: {} }));
        socket.send(
          JSON.stringify({
            method: "Network.requestWillBeSent",
            params: {
              requestId: "req-1",
              request: {
                url: "http://example.com/foo",
                method: "GET",
                headers: { authorization: "Bearer secret" },
              },
            },
          }),
        );
        socket.send(
          JSON.stringify({
            method: "Network.responseReceived",
            params: {
              requestId: "req-1",
              response: { status: 200, statusText: "OK", headers: { "x-test": "yes" } },
            },
          }),
        );
        socket.send(
          JSON.stringify({ method: "Network.loadingFinished", params: { requestId: "req-1" } }),
        );
      } else if (message.method === "Network.getResponseBody") {
        socket.send(
          JSON.stringify({ id: message.id, result: { body: "hello world", base64Encoded: false } }),
        );
      }
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("failed to determine http server port");
  }
  wsPort = address.port;

  const store = new NetworkStore();
  const client = new CdpNetworkClient({ port: wsPort, captureBodies: true });
  client.onRequest((event) => store.addRequest(event));
  client.onResponse((event) => store.addResponse(event));

  try {
    await client.connect();

    const entry = await waitForCompletedEntry(store);
    assert.equal(entry.method, "GET");
    assert.equal(entry.url, "http://example.com/foo");
    assert.equal(entry.requestHeaders.authorization, "[redacted]");
    assert.equal(entry.status, 200);
    assert.equal(entry.responseHeaders?.["x-test"], "yes");
    assert.equal(entry.responseBody, "hello world");
  } finally {
    client.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
});

async function waitForCompletedEntry(store: NetworkStore, timeoutMs = 2000) {
  const start = Date.now();
  while (true) {
    const [entry] = store.getEntries();
    if (entry && !entry.pending) {
      return entry;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for a completed entry");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
