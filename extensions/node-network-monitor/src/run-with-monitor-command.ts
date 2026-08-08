import * as vscode from "vscode";
import { buildMonitorTerminalOptions, runInTerminalWhenReady } from "./terminal-env.js";
import type { Logger } from "./logger.js";

export function registerRunWithMonitorCommand(
  context: vscode.ExtensionContext,
  getTracerEnv: () => Record<string, string>,
  logger: Logger,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("nodeNetworkMonitor.runWithMonitor", async () => {
      const command = await vscode.window.showInputBox({
        title: "Node Network Monitor: Run Command with Monitor",
        prompt: "Command to run in a new terminal with network capturing enabled",
        value: "npm run dev",
        ignoreFocusOut: true,
      });
      if (!command) {
        return;
      }

      const options = buildMonitorTerminalOptions("Node Network Monitor", getTracerEnv());
      logger.channel.show(true);
      logger.log(`Running "${command}" with monitoring enabled (cwd: ${options.cwd ?? "<none>"})`);
      logger.log(`NODE_OPTIONS=${options.env?.NODE_OPTIONS ?? ""}`);

      const terminal = vscode.window.createTerminal(options);
      terminal.show();
      runInTerminalWhenReady(terminal, command);
    }),
  );
}
