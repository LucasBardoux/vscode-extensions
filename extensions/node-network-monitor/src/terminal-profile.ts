import * as vscode from "vscode";
import { buildMonitorTerminalOptions } from "./terminal-env.js";

const PROFILE_ID = "nodeNetworkMonitor.terminalProfile";

/**
 * Lets the user pick "Node Network Monitor" from the terminal panel's profile
 * dropdown (next to "JavaScript Debug Terminal") to get a plain, ready shell
 * with monitoring env vars pre-injected — no command is run automatically.
 */
export function registerTerminalProfile(
  context: vscode.ExtensionContext,
  getTracerEnv: () => Record<string, string>,
): void {
  context.subscriptions.push(
    vscode.window.registerTerminalProfileProvider(PROFILE_ID, {
      provideTerminalProfile: () => {
        return new vscode.TerminalProfile(
          buildMonitorTerminalOptions("Node Network Monitor", getTracerEnv()),
        );
      },
    }),
  );
}
