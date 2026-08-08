const fs = require("fs");

const vsixFiles = fs.readdirSync(".").filter((file) => file.endsWith(".vsix"));

if (vsixFiles.length === 0) {
  console.log("No .vsix files to remove.");
} else {
  for (const file of vsixFiles) {
    fs.unlinkSync(file);
    console.log(`Removed ${file}`);
  }
}
