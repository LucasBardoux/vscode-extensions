const { execFileSync } = require("child_process");
const pkg = require("./package.json");

const extensionId = `${pkg.publisher}.${pkg.name}`;

try {
  // shell: true because "code" is a .cmd shim on Windows, which execFileSync
  // cannot resolve/execute directly without going through a shell.
  execFileSync("code", ["--uninstall-extension", extensionId], { stdio: "inherit", shell: true });
} catch {
  console.log(`"${extensionId}" was not installed — nothing to uninstall.`);
}
