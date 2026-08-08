// Bundled by build-preload.js into standalone dist/collector/tracer-preload.cjs
// (--require) and tracer-preload.mjs (--import) files. Deliberately a static
// import, not a dynamic one: --require executes synchronously, and a dynamic
// import() would defer startTracerFromEnv's synchronous interceptor
// installation past the point where the monitored process's own top-level
// code (which may call fetch()/http.request() immediately) already ran.
import { startTracerFromEnv } from "./tracer.js";

void startTracerFromEnv(process.env).catch((error: unknown) => {
  process.stderr.write(`[network-monitor] failed to start tracer: ${String(error)}\n`);
});
