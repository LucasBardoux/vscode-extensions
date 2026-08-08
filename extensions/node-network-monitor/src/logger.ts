import * as vscode from "vscode";

export interface Logger {
  channel: vscode.OutputChannel;
  log: (message: string) => void;
}

export function createLogger(): Logger {
  const channel = vscode.window.createOutputChannel("Node Network Monitor");
  const log = (message: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    channel.appendLine(`[${timestamp}] ${message}`);
  };
  return { channel, log };
}
