import path from "node:path";
import { detectModuleType, type PreloadResolution } from "@network-monitor/core";

/**
 * @network-monitor/core's own getPreloadPath() locates its compiled
 * tracer-preload.(c|m)js via import.meta.url, which only works when that
 * package's dist/ is used directly and unbundled. Here it gets bundled into
 * this extension's single dist/extension.js (so it can ship as one vsix
 * without a node_modules symlink), which breaks import.meta.url resolution.
 * The two preload files are therefore copied as static assets next to
 * dist/extension.js at build time (see esbuild.js), and resolved here
 * relative to __dirname — which esbuild provides correctly for CJS output.
 */
export function resolveBundledPreload(startPath: string | undefined): PreloadResolution {
  const moduleType = detectModuleType(startPath);
  const fileName = moduleType === "module" ? "tracer-preload.mjs" : "tracer-preload.cjs";
  return {
    flag: moduleType === "module" ? "--import" : "--require",
    path: path.join(__dirname, fileName),
  };
}
