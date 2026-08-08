const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");

const corePreloadDir = path.join(__dirname, "..", "..", "packages", "network-monitor-core", "dist", "collector");
const preloadFiles = ["tracer-preload.cjs", "tracer-preload.mjs"];

function copyPreloadFiles() {
  fs.mkdirSync("dist", { recursive: true });
  for (const fileName of preloadFiles) {
    fs.copyFileSync(path.join(corePreloadDir, fileName), path.join("dist", fileName));
  }
}

const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  target: "node18",
  sourcemap: true,
  // Only "vscode" is external (provided by the extension host at runtime).
  // @network-monitor/core is an npm-workspace symlink, not a real published
  // package, so it must be bundled in — vsce's packager can't follow the
  // symlink out of the extension folder to include it as a dependency.
  external: ["vscode"],
};

const webviewConfig = {
  entryPoints: ["src/webview/main.ts"],
  bundle: true,
  outfile: "dist/webview.js",
  platform: "browser",
  format: "iife",
  target: "es2022",
  sourcemap: true,
};

const webviewStyleConfig = {
  entryPoints: ["src/webview/style.css"],
  bundle: true,
  outfile: "dist/webview.css",
};

async function run() {
  const configs = [extensionConfig, webviewConfig, webviewStyleConfig];

  if (watch) {
    const contexts = await Promise.all(configs.map((config) => esbuild.context(config)));
    await Promise.all(contexts.map((context) => context.watch()));
    copyPreloadFiles();
    console.log("watching for changes...");
    return;
  }

  await Promise.all(configs.map((config) => esbuild.build(config)));
  copyPreloadFiles();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
