import net from "node:net";
import { serializeMessage } from "./protocol.js";
import type { NetworkProtocolEvent } from "../events.js";

export interface TracerClientOptions {
  host?: string;
  port: number;
  token: string;
  processLabel?: string;
  connectAttempts?: number;
  connectRetryDelayMs?: number;
}

interface ResolvedTracerClientOptions {
  host: string;
  port: number;
  token: string;
  processLabel: string | undefined;
  connectAttempts: number;
  connectRetryDelayMs: number;
}

/**
 * Runs inside the monitored process. Connects out to the CollectorServer
 * over plain TCP (no dependency needed here beyond Node core) and forwards
 * captured network events as newline-delimited JSON.
 */
export class TracerClient {
  private readonly options: ResolvedTracerClientOptions;
  private socket: net.Socket | undefined;
  private connected = false;
  private readonly queue: NetworkProtocolEvent[] = [];

  constructor(options: TracerClientOptions) {
    this.options = {
      host: options.host ?? "127.0.0.1",
      port: options.port,
      token: options.token,
      processLabel: options.processLabel,
      connectAttempts: options.connectAttempts ?? 5,
      connectRetryDelayMs: options.connectRetryDelayMs ?? 200,
    };
  }

  async connect(): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.options.connectAttempts; attempt++) {
      try {
        await this.tryConnect();
        return;
      } catch (error) {
        lastError = error;
        await delay(this.options.connectRetryDelayMs);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to connect to network monitor collector");
  }

  send(event: NetworkProtocolEvent): void {
    if (!this.connected || !this.socket) {
      this.queue.push(event);
      return;
    }
    this.socket.write(serializeMessage(event));
  }

  close(): void {
    this.socket?.destroy();
    this.socket = undefined;
    this.connected = false;
  }

  private async tryConnect(): Promise<void> {
    const socket = net.connect(this.options.port, this.options.host);
    await new Promise<void>((resolve, reject) => {
      const onConnect = (): void => {
        socket.off("error", onError);
        resolve();
      };
      const onError = (error: Error): void => {
        socket.off("connect", onConnect);
        reject(error);
      };
      socket.once("connect", onConnect);
      socket.once("error", onError);
    });

    // Must not keep the host process alive on its own: NODE_OPTIONS also
    // applies to unrelated short-lived Node invocations in the same
    // environment (e.g. npm's own internal bootstrap/run-script processes
    // when launching "npm run <script>"). A ref'd socket there means those
    // processes never exit naturally, which stalls the entire "npm run ..."
    // invocation before it even prints its banner.
    socket.unref();

    socket.write(
      serializeMessage({
        type: "hello",
        token: this.options.token,
        processLabel: this.options.processLabel,
      }),
    );
    socket.on("error", () => {
      this.connected = false;
    });
    socket.on("close", () => {
      this.connected = false;
    });

    this.socket = socket;
    this.connected = true;
    this.flushQueue();
  }

  private flushQueue(): void {
    const socket = this.socket;
    if (!socket) {
      return;
    }
    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (event) {
        socket.write(serializeMessage(event));
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
