import * as vscode from "vscode";
import { appendNodeOptions } from "@network-monitor/core";
import { resolveBundledPreload } from "./preload-paths.js";
import type { Logger } from "./logger.js";

const SUPPORTED_TYPES = ["node", "pwa-node"];

/**
 * Opt-in resolver: only touches launch configs that explicitly set
 * `"nodeNetworkMonitor": true`, so unrelated node/pwa-node debug sessions are
 * left untouched.
 */
export function registerDebugConfigProvider(
  context: vscode.ExtensionContext,
  getTracerEnv: () => Record<string, string>,
  log: Logger["log"],
): void {
  const provider: vscode.DebugConfigurationProvider = {
    resolveDebugConfiguration(folder, config) {
      if (!SUPPORTED_TYPES.includes(config.type) || config.nodeNetworkMonitor !== true) {
        return config;
      }

      const cwd = typeof config.cwd === "string" ? config.cwd : folder?.uri.fsPath;
      const programPath = typeof config.program === "string" ? config.program : undefined;
      const resolution = resolveBundledPreload(programPath ?? cwd);

      const existingEnv = isRecord(config.env) ? (config.env as Record<string, string>) : {};
      const tracerEnv = getTracerEnv();
      const nodeOptions = appendNodeOptions(existingEnv.NODE_OPTIONS, resolution);

      config.env = {
        ...existingEnv,
        ...tracerEnv,
        NODE_OPTIONS: nodeOptions,
      };

      log(
        `Injected network monitoring into debug config "${String(config.name)}" — NODE_OPTIONS=${nodeOptions}`,
      );

      return config;
    },
  };

  for (const type of SUPPORTED_TYPES) {
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(type, provider));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
