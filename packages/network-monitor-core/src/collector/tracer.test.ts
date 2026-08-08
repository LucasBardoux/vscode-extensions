import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { CollectorServer } from "./collector-server.js";
import { startTracer, isPackageManagerOwnProcess } from "./tracer.js";
import type { NetworkEntry } from "../events.js";
import { NetworkStore } from "../store.js";

test("captures a fetch() call and a http.request() call end-to-end through the collector", async () => {
  const backend = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("X-Backend", "yes");
      res.statusCode = req.url === "/error" ? 500 : 200;
      res.end(JSON.stringify({ path: req.url, method: req.method, body }));
    });
  });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const backendAddress = backend.address();
  if (backendAddress === null || typeof backendAddress === "string") {
    throw new Error("failed to determine backend port");
  }
  const backendPort = backendAddress.port;

  const collector = new CollectorServer();
  const { port, token } = await collector.start();

  const store = new NetworkStore();
  collector.onRequest((event) => store.addRequest(event));
  collector.onResponse((event) => store.addResponse(event));

  const tracer = await startTracer({ port, token, captureBodies: true });

  try {
    await fetch(`http://127.0.0.1:${backendPort}/foo?x=1`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer secret" },
      body: JSON.stringify({ hello: "world" }),
    });

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        `http://127.0.0.1:${backendPort}/bar`,
        { method: "PUT", headers: { "content-type": "text/plain" } },
        (res) => {
          res.resume();
          res.on("end", resolve);
        },
      );
      req.on("error", reject);
      req.end("raw-body");
    });

    const entries = await waitForEntries(store, 2);
    const fetchEntry = entries.find((e) => e.source === "fetch");
    const httpEntry = entries.find((e) => e.source === "http");

    assert.ok(fetchEntry, "expected a fetch entry");
    assert.equal(fetchEntry?.method, "POST");
    assert.match(fetchEntry?.url ?? "", /\/foo\?x=1$/);
    assert.equal(fetchEntry?.requestHeaders.authorization, "[redacted]");
    assert.equal(fetchEntry?.requestBody, '{"hello":"world"}');
    assert.equal(fetchEntry?.status, 200);
    assert.equal(fetchEntry?.responseHeaders?.["x-backend"], "yes");
    assert.ok(fetchEntry?.responseBody?.includes("hello"));

    assert.ok(httpEntry, "expected a http entry");
    assert.equal(httpEntry?.method, "PUT");
    assert.match(httpEntry?.url ?? "", /\/bar$/);
    assert.equal(httpEntry?.requestBody, "raw-body");
    assert.equal(httpEntry?.status, 200);
  } finally {
    tracer.stop();
    await collector.stop();
    await new Promise<void>((resolve) => backend.close(() => resolve()));
  }
});

test("captures a binary image response as base64 without corrupting the bytes", async () => {
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xde, 0xad, 0xbe, 0xef,
  ]);
  const backend = http.createServer((req, res) => {
    res.setHeader("content-type", "image/png");
    res.end(pngBytes);
  });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const backendAddress = backend.address();
  if (backendAddress === null || typeof backendAddress === "string") {
    throw new Error("failed to determine backend port");
  }
  const backendPort = backendAddress.port;

  const collector = new CollectorServer();
  const { port, token } = await collector.start();
  const store = new NetworkStore();
  collector.onRequest((event) => store.addRequest(event));
  collector.onResponse((event) => store.addResponse(event));

  const tracer = await startTracer({ port, token, captureBodies: true });

  try {
    await fetch(`http://127.0.0.1:${backendPort}/image.png`);
    const [entry] = await waitForEntries(store, 1);

    assert.equal(entry?.responseBodyEncoding, "base64");
    assert.equal(entry?.responseBody, pngBytes.toString("base64"));
    assert.deepEqual(
      entry?.responseBody ? Buffer.from(entry.responseBody, "base64") : undefined,
      pngBytes,
    );
  } finally {
    tracer.stop();
    await collector.stop();
    await new Promise<void>((resolve) => backend.close(() => resolve()));
  }
});

test("isPackageManagerOwnProcess recognizes npm's own internal scripts", () => {
  assert.equal(
    isPackageManagerOwnProcess([
      "node",
      "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-prefix.js",
    ]),
    true,
  );
  assert.equal(
    isPackageManagerOwnProcess([
      "node",
      "C:\\Users\\tower\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
      "run",
      "dev",
    ]),
    true,
  );
  assert.equal(
    isPackageManagerOwnProcess(["node", "/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs"]),
    true,
  );
  assert.equal(
    isPackageManagerOwnProcess(["node", "/usr/local/lib/node_modules/yarn/bin/yarn.js"]),
    true,
  );
});

test("isPackageManagerOwnProcess does not flag the actual monitored script", () => {
  assert.equal(
    isPackageManagerOwnProcess(["node", "C:\\Users\\tower\\Desktop\\my-backend\\index.js"]),
    false,
  );
  assert.equal(isPackageManagerOwnProcess(["node"]), false);
});

async function waitForEntries(
  store: NetworkStore,
  count: number,
  timeoutMs = 3000,
): Promise<readonly NetworkEntry[]> {
  const start = Date.now();
  while (true) {
    const entries = store.getEntries();
    if (entries.length >= count && entries.every((e) => !e.pending)) {
      return entries;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${count} completed entries, got ${entries.length}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
