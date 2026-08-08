import type { StartTracerOptions } from "./tracer.js";

const ENV_PORT = "NETMON_PORT";
const ENV_TOKEN = "NETMON_TOKEN";
const ENV_PROCESS_LABEL = "NETMON_PROCESS_LABEL";
const ENV_CAPTURE_BODIES = "NETMON_CAPTURE_BODIES";
const ENV_MAX_BODY_BYTES = "NETMON_MAX_BODY_BYTES";
const ENV_REDACT_HEADERS = "NETMON_REDACT_HEADERS";

/**
 * Reads the tracer configuration the extension injects into the monitored
 * process via NODE_OPTIONS + env vars. Returns undefined when the process
 * wasn't launched through the extension (no NETMON_PORT/NETMON_TOKEN set),
 * so preloading this module is always a safe no-op otherwise.
 */
export function readTracerOptionsFromEnv(env: NodeJS.ProcessEnv): StartTracerOptions | undefined {
  const portRaw = env[ENV_PORT];
  const token = env[ENV_TOKEN];
  if (!portRaw || !token) {
    return undefined;
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    return undefined;
  }

  const processLabel = env[ENV_PROCESS_LABEL];
  const captureBodiesRaw = env[ENV_CAPTURE_BODIES];
  const captureBodies = captureBodiesRaw === undefined ? undefined : captureBodiesRaw !== "0";
  const maxBodyBytesRaw = env[ENV_MAX_BODY_BYTES];
  const maxBodyBytes = maxBodyBytesRaw ? Number(maxBodyBytesRaw) : undefined;
  const redactHeadersRaw = env[ENV_REDACT_HEADERS];
  const redactHeaderNames = redactHeadersRaw
    ? redactHeadersRaw
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    : undefined;

  return {
    port,
    token,
    ...(processLabel !== undefined ? { processLabel } : {}),
    ...(captureBodies !== undefined ? { captureBodies } : {}),
    ...(maxBodyBytes !== undefined ? { maxBodyBytes } : {}),
    ...(redactHeaderNames !== undefined ? { redactHeaderNames } : {}),
  };
}

export type TracerEnvOptions = Omit<StartTracerOptions, "host">;

/**
 * Inverse of {@link readTracerOptionsFromEnv}: builds the env vars the
 * extension injects (via NODE_OPTIONS) into the process it launches.
 */
export function buildTracerEnv(options: TracerEnvOptions): Record<string, string> {
  const env: Record<string, string> = {
    [ENV_PORT]: String(options.port),
    [ENV_TOKEN]: options.token,
  };
  if (options.processLabel !== undefined) {
    env[ENV_PROCESS_LABEL] = options.processLabel;
  }
  if (options.captureBodies !== undefined) {
    env[ENV_CAPTURE_BODIES] = options.captureBodies ? "1" : "0";
  }
  if (options.maxBodyBytes !== undefined) {
    env[ENV_MAX_BODY_BYTES] = String(options.maxBodyBytes);
  }
  if (options.redactHeaderNames !== undefined) {
    env[ENV_REDACT_HEADERS] = options.redactHeaderNames.join(",");
  }
  return env;
}
