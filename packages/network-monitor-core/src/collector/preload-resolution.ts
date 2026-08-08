import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type ModuleType = "commonjs" | "module";

export interface PreloadResolution {
  flag: "--require" | "--import";
  path: string;
}

/**
 * Absolute path to this package's own compiled preload wrapper. Resolved via
 * import.meta.url (a sibling of this file in dist/collector/) rather than
 * require.resolve() from the consumer's side, so it keeps working regardless
 * of how the extension bundles or externalizes this package.
 */
export function getPreloadPath(moduleType: ModuleType): string {
  const fileName = moduleType === "module" ? "tracer-preload.mjs" : "tracer-preload.cjs";
  return fileURLToPath(new URL(fileName, import.meta.url));
}

/**
 * Walks up from `startPath` looking for the nearest package.json to decide
 * whether the target program is CommonJS (default) or an ES module, so the
 * caller knows whether to inject `--require` or `--import`.
 */
export function detectModuleType(startPath: string | undefined): ModuleType {
  if (!startPath) {
    return "commonjs";
  }

  let dir: string;
  try {
    dir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
  } catch {
    dir = path.dirname(startPath);
  }

  const root = path.parse(dir).root;
  for (;;) {
    const packageJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { type?: string };
        return parsed.type === "module" ? "module" : "commonjs";
      } catch {
        return "commonjs";
      }
    }
    if (dir === root) {
      return "commonjs";
    }
    dir = path.dirname(dir);
  }
}

export function resolvePreload(startPath: string | undefined): PreloadResolution {
  const moduleType = detectModuleType(startPath);
  return {
    flag: moduleType === "module" ? "--import" : "--require",
    path: getPreloadPath(moduleType),
  };
}

function quoteIfNeeded(value: string): string {
  return value.includes(" ") ? `"${value}"` : value;
}

export function appendNodeOptions(
  existing: string | undefined,
  resolution: PreloadResolution,
): string {
  // --require uses plain CJS module resolution, which accepts a raw OS path.
  // --import goes through the ESM loader, which (notably on Windows) requires
  // an actual file:// URL rather than a bare drive-letter path.
  const target =
    resolution.flag === "--import" ? pathToFileURL(resolution.path).href : resolution.path;
  const addition = `${resolution.flag} ${quoteIfNeeded(target)}`;
  return existing && existing.trim().length > 0 ? `${existing.trim()} ${addition}` : addition;
}
