const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const RELEASE_DIR = path.join(ROOT_DIR, "release");
const PACKAGE_NAME = "CLMS_Librarian_Package";
const APP_DIR = path.join(RELEASE_DIR, PACKAGE_NAME);

function log(msg) {
  console.log(`[RELEASE] ${msg}`);
}

function copyDir(src, dest, exclude = []) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === "coverage" ||
        entry.name === "release"
      )
        continue;
      copyDir(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  try {
    // 1. Clean Release Dir
    if (fs.existsSync(RELEASE_DIR)) {
      log("Cleaning release directory...");
      fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(APP_DIR, { recursive: true });

    // 2. Copy Project Files
    log("Copying project files...");
    const excludeRoot = [
      ".git",
      ".vscode",
      "node_modules",
      "release",
      "tests",
      "test-results",
      "playwright-report",
      ".env.local",
      "tmp",
      "temp",
    ];
    copyDir(ROOT_DIR, APP_DIR, excludeRoot);

    // 3. Create Production Env File
    log("Creating production configuration...");
    if (fs.existsSync(path.join(ROOT_DIR, ".env.production"))) {
      fs.copyFileSync(
        path.join(ROOT_DIR, ".env.production"),
        path.join(APP_DIR, ".env")
      );
    } else if (fs.existsSync(path.join(ROOT_DIR, ".env.example"))) {
      fs.copyFileSync(
        path.join(ROOT_DIR, ".env.example"),
        path.join(APP_DIR, ".env")
      );
    }

    // 4. Create Launcher Script (if not exists)
    // Use CRLF for Windows batch file compatibility
    const launcher = `@echo off\r\n
echo Starting CLMS...\r\n
docker-compose -f docker-compose.prod.yml up -d --build\r\n
echo.\r\n
echo System started! Access at http://localhost\r\n
pause\r\n
`;
    fs.writeFileSync(path.join(APP_DIR, "CLMS_LAUNCHER.bat"), launcher);

    // 5. Create Instructions
    const instructions = `CLMS Librarian Package\r\n
======================\r\n
\r\n
Installation:\r\n
1. Install Docker Desktop for Windows (https://www.docker.com/products/docker-desktop/).\r\n
2. Copy this folder to your Desktop.\r\n
\r\n
Usage:\r\n
1. Double-click 'CLMS_LAUNCHER.bat' to start the system.\r\n
2. Open your browser to http://localhost.\r\n
\r\n
Troubleshooting:\r\n
- Ensure Docker Desktop is running before starting.\r\n
- If the system doesn't start, try running 'docker-compose -f docker-compose.prod.yml logs' in a terminal to see errors.\r\n
`;
    fs.writeFileSync(path.join(APP_DIR, "README_INSTALL.txt"), instructions);

    log("Package created successfully at: " + APP_DIR);
    log("You can now zip this folder and send it to the librarian.");
  } catch (error) {
    console.error("Packaging failed:", error);
    process.exit(1);
  }
}

main();
