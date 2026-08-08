const esbuild = require("esbuild");

const shared = {
  entryPoints: ["src/collector/tracer-preload-entry.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: false,
};

async function run() {
  await Promise.all([
    esbuild.build({ ...shared, format: "cjs", outfile: "dist/collector/tracer-preload.cjs" }),
    esbuild.build({ ...shared, format: "esm", outfile: "dist/collector/tracer-preload.mjs" }),
  ]);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
