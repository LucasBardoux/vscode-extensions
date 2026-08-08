import * as vscode from "vscode";
import { CollectorServer, NetworkStore, buildTracerEnv } from "@network-monitor/core";
import { NetworkViewProvider } from "./network-view-provider.js";
import { registerDebugConfigProvider } from "./debug-config-provider.js";
import { registerRunWithMonitorCommand } from "./run-with-monitor-command.js";
import { registerCdpAttachCommand } from "./cdp-attach-command.js";
import { registerTerminalProfile } from "./terminal-profile.js";
import { createLogger } from "./logger.js";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const { channel, log } = createLogger();
  context.subscriptions.push(channel);

  const store = new NetworkStore(readSetting("maxEntries", 500));
  const collector = new CollectorServer();
  const { port, token } = await collector.start();
  log(`Collector listening on 127.0.0.1:${port}`);

  let paused = false;

  collector.onConnection((info) => {
    log(`Tracer connected${info.processLabel ? ` (${info.processLabel})` : ""}`);
  });
  collector.onAuthFailure((reason) => {
    log(`Rejected an incoming connection: ${reason}`);
  });
  collector.onRequest((event) => {
    log(`-> ${event.method} ${event.url} [${event.source}]`);
    if (!paused) {
      store.addRequest(event);
    }
  });
  collector.onResponse((event) => {
    log(
      event.error
        ? `<- error: ${event.error} [id=${event.id}]`
        : `<- ${event.status} (${event.durationMs}ms) [id=${event.id}]`,
    );
    if (!paused) {
      store.addResponse(event);
    }
  });

  const viewProvider = new NetworkViewProvider(context.extensionUri, store);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(NetworkViewProvider.viewType, viewProvider),
    vscode.commands.registerCommand("nodeNetworkMonitor.clear", () => store.clear()),
    vscode.commands.registerCommand("nodeNetworkMonitor.togglePause", () => {
      paused = !paused;
      viewProvider.setPaused(paused);
      log(paused ? "Capturing paused" : "Capturing resumed");
    }),
    vscode.commands.registerCommand("nodeNetworkMonitor.showLog", () => channel.show(true)),
    { dispose: () => void collector.stop() },
  );

  const getTracerEnv = (): Record<string, string> => currentTracerEnv(port, token);
  registerDebugConfigProvider(context, getTracerEnv, log);
  registerRunWithMonitorCommand(context, getTracerEnv, { channel, log });
  registerCdpAttachCommand(context, store, log);
  registerTerminalProfile(context, getTracerEnv);
}

export function deactivate(): void {
  // Collector/CDP client teardown is handled via context.subscriptions disposables.
}

function currentTracerEnv(port: number, token: string): Record<string, string> {
  return buildTracerEnv({
    port,
    token,
    captureBodies: readSetting("captureBodies", true),
    maxBodyBytes: readSetting("maxBodyBytes", 2_000_000),
    redactHeaderNames: readSetting<string[]>("redactHeaders", []),
  });
}

function readSetting<T>(key: string, defaultValue: T): T {
  return vscode.workspace.getConfiguration("nodeNetworkMonitor").get<T>(key, defaultValue);
}
