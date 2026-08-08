import { TracerClient } from "./tracer-client.js";
import { installFetchInterceptor } from "./fetch-interceptor.js";
import { installHttpInterceptor } from "./http-interceptor.js";
import { readTracerOptionsFromEnv } from "./env-options.js";
import { DEFAULT_REDACTED_HEADERS, DEFAULT_MAX_BODY_BYTES } from "../redact.js";
import type { TracerConfig } from "./tracer-config.js";

export interface StartTracerOptions {
  host?: string;
  port: number;
  token: string;
  processLabel?: string;
  captureBodies?: boolean;
  maxBodyBytes?: number;
  redactHeaderNames?: readonly string[];
}

export interface Tracer {
  stop: () => void;
}

/**
 * Installs the fetch/http interceptors and connects to the CollectorServer
 * running in the extension host. This is the single entry point both the CJS
 * (`--require`) and ESM (`--import`) preload wrappers call into.
 */
export async function startTracer(options: StartTracerOptions): Promise<Tracer> {
  const client = new TracerClient({
    port: options.port,
    token: options.token,
    ...(options.host !== undefined ? { host: options.host } : {}),
    ...(options.processLabel !== undefined ? { processLabel: options.processLabel } : {}),
  });

  const config: TracerConfig = {
    captureBodies: options.captureBodies ?? true,
    maxBodyBytes: options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    redactHeaderNames: options.redactHeaderNames ?? DEFAULT_REDACTED_HEADERS,
    emit: (event) => client.send(event),
  };

  const uninstallFetch = installFetchInterceptor(config);
  const uninstallHttp = installHttpInterceptor(config);

  const stop = (): void => {
    uninstallFetch();
    uninstallHttp();
    client.close();
  };

  try {
    await client.connect();
  } catch (error) {
    // No collector reachable (e.g. the process wasn't started through the
    // extension) — uninstall rather than silently queuing events forever.
    stop();
    process.stderr.write(
      `[network-monitor] could not connect to collector at ${options.host ?? "127.0.0.1"}:${options.port}: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
  }

  return { stop };
}

/**
 * Entry point for the CJS/ESM preload wrappers: reads NETMON_* env vars and
 * starts the tracer only if the process was launched through the extension.
 */
export async function startTracerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<Tracer | undefined> {
  if (isPackageManagerOwnProcess(process.argv)) {
    return undefined;
  }
  const options = readTracerOptionsFromEnv(env);
  if (!options) {
    return undefined;
  }
  return startTracer(options);
}

/**
 * NODE_OPTIONS applies to every Node invocation in the environment it's set
 * in — not just the script the user actually cares about. That includes npm
 * (and similar tools) invoking themselves as plain Node processes, e.g. for
 * `npm run <script>`. Patching fetch/http there risks interfering with
 * whatever internal network calls the package manager itself makes (update
 * checks, registry lookups, ...), which has been observed to hang `npm run`
 * entirely. Skip instrumenting these processes; the actual script process
 * npm spawns is unaffected and gets traced normally.
 */
export function isPackageManagerOwnProcess(argv: readonly string[] = process.argv): boolean {
  const entry = argv[1];
  if (!entry) {
    return false;
  }
  // Package managers ship several internal scripts (npm-cli.js, npm-prefix.js,
  // ...) whose exact names vary across versions/tools, so match on the
  // node_modules/<tool>/ path segment rather than a specific filename.
  const normalized = entry.replace(/\\/g, "/").toLowerCase();
  return /\/node_modules\/(npm|npx|pnpm|yarn|corepack)\//.test(normalized);
}
