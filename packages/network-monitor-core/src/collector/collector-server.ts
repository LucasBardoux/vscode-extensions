import net from "node:net";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { isNetworkRequestEvent, isNetworkResponseEvent } from "../events.js";
import type { NetworkRequestEvent, NetworkResponseEvent } from "../events.js";
import { parseLine, isHelloMessage } from "./protocol.js";

export interface CollectorServerOptions {
  host?: string;
}

export interface CollectorStartResult {
  port: number;
  token: string;
}

/**
 * Local, token-gated TCP server that the preload tracer connects out to.
 * Deliberately plain net + newline-delimited JSON (no `ws` dependency) so the
 * tracer, which runs inside an arbitrary target Node process, has no
 * third-party dependency requirements of its own.
 */
export class CollectorServer {
  private readonly emitter = new EventEmitter();
  private readonly host: string;
  private server: net.Server | undefined;
  private token: string | undefined;

  constructor(options: CollectorServerOptions = {}) {
    this.host = options.host ?? "127.0.0.1";
  }

  async start(): Promise<CollectorStartResult> {
    if (this.server) {
      throw new Error("CollectorServer is already started");
    }
    const token = randomBytes(16).toString("hex");
    const server = net.createServer((socket) => this.handleConnection(socket, token));

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, this.host, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Failed to determine collector server port");
    }

    this.server = server;
    this.token = token;
    return { port: address.port, token };
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    this.server = undefined;
    this.token = undefined;
  }

  onRequest(listener: (event: NetworkRequestEvent) => void): () => void {
    this.emitter.on("request", listener);
    return () => {
      this.emitter.off("request", listener);
    };
  }

  onResponse(listener: (event: NetworkResponseEvent) => void): () => void {
    this.emitter.on("response", listener);
    return () => {
      this.emitter.off("response", listener);
    };
  }

  /** Fires once a tracer successfully authenticates (useful for diagnostics). */
  onConnection(listener: (info: { processLabel: string | undefined }) => void): () => void {
    this.emitter.on("connection", listener);
    return () => {
      this.emitter.off("connection", listener);
    };
  }

  /** Fires when a connection sends a bad/missing token (useful for diagnostics). */
  onAuthFailure(listener: (reason: string) => void): () => void {
    this.emitter.on("auth-failure", listener);
    return () => {
      this.emitter.off("auth-failure", listener);
    };
  }

  private handleConnection(socket: net.Socket, expectedToken: string): void {
    let buffer = "";
    let authenticated = false;

    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");

        if (line.length === 0) {
          continue;
        }

        if (!authenticated) {
          const message = parseLine(line);
          if (!message || !isHelloMessage(message)) {
            this.emitter.emit("auth-failure", "first message was not a valid hello");
            socket.destroy();
            return;
          }
          if (message.token !== expectedToken) {
            this.emitter.emit("auth-failure", "token mismatch");
            socket.destroy();
            return;
          }
          authenticated = true;
          this.emitter.emit("connection", { processLabel: message.processLabel });
          continue;
        }

        const message = parseLine(line);
        if (!message || isHelloMessage(message)) {
          continue;
        }
        if (isNetworkRequestEvent(message)) {
          this.emitter.emit("request", message);
        } else if (isNetworkResponseEvent(message)) {
          this.emitter.emit("response", message);
        }
      }
    });

    socket.on("error", () => socket.destroy());
  }
}
