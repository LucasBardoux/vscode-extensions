import * as vscode from "vscode";
import { CdpNetworkClient, type NetworkStore } from "@network-monitor/core";
import type { Logger } from "./logger.js";

export function registerCdpAttachCommand(
  context: vscode.ExtensionContext,
  store: NetworkStore,
  log: Logger["log"],
): void {
  let activeClient: CdpNetworkClient | undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand("nodeNetworkMonitor.attachCdp", async () => {
      const input = await vscode.window.showInputBox({
        title: "Node Network Monitor: Attach to Running Process (CDP)",
        prompt: "host:port of a process started with --inspect --experimental-network-inspection",
        value: "localhost:9229",
        ignoreFocusOut: true,
      });
      if (!input) {
        return;
      }

      const separatorIndex = input.lastIndexOf(":");
      const host = separatorIndex === -1 ? input : input.slice(0, separatorIndex);
      const port = Number(separatorIndex === -1 ? "9229" : input.slice(separatorIndex + 1));
      if (!host || !Number.isFinite(port)) {
        void vscode.window.showErrorMessage(`Node Network Monitor: invalid address "${input}"`);
        return;
      }

      activeClient?.close();
      const client = new CdpNetworkClient({ host, port });
      client.onRequest((event) => store.addRequest(event));
      client.onResponse((event) => store.addResponse(event));

      try {
        await client.connect();
        activeClient = client;
        log(`CDP: attached to ${host}:${port}`);
        void vscode.window.showInformationMessage(
          `Node Network Monitor: attached to ${host}:${port}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`CDP: failed to attach to ${host}:${port}: ${message}`);
        void vscode.window.showErrorMessage(
          `Node Network Monitor: failed to attach to ${host}:${port}: ${message}`,
        );
      }
    }),
  );

  context.subscriptions.push({
    dispose: () => {
      activeClient?.close();
    },
  });
}
