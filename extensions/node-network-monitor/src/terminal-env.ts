import * as vscode from "vscode";
import { appendNodeOptions } from "@network-monitor/core";
import { resolveBundledPreload } from "./preload-paths.js";

/**
 * Shared by the "Run Command with Monitor" command and the "Network Monitor"
 * terminal profile: a terminal whose environment has the tracer preload
 * injected via NODE_OPTIONS, ready for any command to be run in it.
 */
export function buildMonitorTerminalOptions(
  name: string,
  tracerEnv: Record<string, string>,
): vscode.TerminalOptions {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const resolution = resolveBundledPreload(cwd);
  return {
    name,
    ...(cwd !== undefined ? { cwd } : {}),
    env: {
      ...tracerEnv,
      NODE_OPTIONS: appendNodeOptions(undefined, resolution),
    },
  };
}

/**
 * Runs `command` in `terminal` as soon as it's actually ready to accept input.
 * `terminal.sendText()` right after `createTerminal()` races the shell's own
 * startup (profile loading, prompt init) and can silently drop the command —
 * which is exactly what shell integration exists to avoid. Falls back to
 * plain sendText if shell integration never activates (e.g. an unsupported
 * shell), matching the pattern from the VS Code API docs.
 */
export function runInTerminalWhenReady(terminal: vscode.Terminal, command: string): void {
  if (terminal.shellIntegration) {
    terminal.shellIntegration.executeCommand(command);
    return;
  }

  let settled = false;
  const changeListener = vscode.window.onDidChangeTerminalShellIntegration((event) => {
    if (event.terminal !== terminal || settled) {
      return;
    }
    settled = true;
    changeListener.dispose();
    clearTimeout(fallbackTimer);
    event.shellIntegration.executeCommand(command);
  });

  const fallbackTimer = setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    changeListener.dispose();
    terminal.sendText(command);
  }, 3000);
}
