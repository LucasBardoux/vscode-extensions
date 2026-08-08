const fs = require("fs");
const { execFileSync } = require("child_process");

const vsixFiles = fs.readdirSync(".").filter((file) => file.endsWith(".vsix"));

if (vsixFiles.length === 0) {
  console.error("No .vsix file found — run `npm run package` first.");
  process.exit(1);
}
if (vsixFiles.length > 1) {
  console.error(
    `Multiple .vsix files found (${vsixFiles.join(", ")}) — run \`npm run clean:vsix\` first.`,
  );
  process.exit(1);
}

const [vsixFile] = vsixFiles;
console.log(`Installing ${vsixFile}...`);
// shell: true because "code" is a .cmd shim on Windows, which execFileSync
// cannot resolve/execute directly without going through a shell.
execFileSync("code", ["--install-extension", vsixFile], { stdio: "inherit", shell: true });
