#!/usr/bin/env node

/**
 * Simple JavaScript link validation script for CLMS documentation
 * Created: October 18, 2025
 * Purpose: Validate all markdown links in the project
 */

const fs = require("fs");
const path = require("path");

// Configuration
const config = {
  rootPath: ".",
  excludeDirs: [
    "node_modules",
    "dist",
    "build",
    ".git",
    ".vscode",
    ".github",
    ".kilo",
    "reports",
  ],
  excludeFiles: [".DS_Store"],
  verbose: false,
};

// Statistics
const stats = {
  filesChecked: 0,
  totalLinks: 0,
  validLinks: 0,
  brokenLinks: 0,
  externalLinks: 0,
  anchorLinks: 0,
};

const brokenLinks = [];

// Utility functions
function isExcluded(filePath) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/").filter(Boolean);

  if (config.excludeDirs.some((dir) => segments.includes(dir))) {
    return true;
  }

  return config.excludeFiles.some((file) => normalizedPath.endsWith(file));
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function resolveLinkPath(linkPath, currentFileDir) {
  if (path.isAbsolute(linkPath)) {
    return linkPath;
  }

  const cleanPath = linkPath.split("#")[0]; // Remove anchor
  return path.resolve(currentFileDir, cleanPath);
}

function extractAnchors(content) {
  const anchors = new Set();
  const headingRegex = /^#+\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const heading = match[1].trim();
    const anchor = heading
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    anchors.add(anchor);
  }

  return anchors;
}

function validateMarkdownLinks(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const fileDir = path.dirname(filePath);
    const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];

    stats.filesChecked++;
    stats.totalLinks += links.length;

    if (config.verbose) {
      console.log(`\n📄 Processing: ${path.relative(process.cwd(), filePath)}`);
      console.log(`   Found ${links.length} links`);
    }

    const anchors = extractAnchors(content);

    links.forEach((link) => {
      const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!match) return;

      const [, linkText, linkPath] = match;

      // External links
      if (
        linkPath.startsWith("http://") ||
        linkPath.startsWith("https://") ||
        linkPath.startsWith("mdc:") ||
        linkPath.startsWith("mailto:")
      ) {
        stats.externalLinks++;
        stats.validLinks++;
        if (config.verbose) {
          console.log(`   🔗 External: ${linkPath}`);
        }
        return;
      }

      // Anchor links
      if (linkPath.startsWith("#")) {
        stats.anchorLinks++;
        const anchor = linkPath.substring(1);
        if (anchors.has(anchor)) {
          stats.validLinks++;
          if (config.verbose) {
            console.log(`   ✅ Anchor: #${anchor}`);
          }
        } else {
          stats.brokenLinks++;
          brokenLinks.push({
            file: filePath,
            linkText,
            linkPath,
            type: "Anchor",
            error: `Anchor #${anchor} not found in document`,
          });
          console.log(`   ❌ Broken anchor: #${anchor} in [${linkText}]`);
        }
        return;
      }

      // Internal file links
      const resolvedPath = resolveLinkPath(linkPath, fileDir);
      const anchorPart = linkPath.includes("#") ? linkPath.split("#")[1] : null;

      if (fs.existsSync(resolvedPath)) {
        stats.validLinks++;

        // Check anchor if present
        if (anchorPart) {
          try {
            const targetContent = fs.readFileSync(resolvedPath, "utf8");
            const targetAnchors = extractAnchors(targetContent);

            if (!targetAnchors.has(anchorPart)) {
              stats.brokenLinks++;
              stats.validLinks--; // Remove the valid count
              brokenLinks.push({
                file: filePath,
                linkText,
                linkPath,
                type: "Anchor in File",
                targetFile: resolvedPath,
                error: `Anchor #${anchorPart} not found in target file`,
              });
              console.log(
                `   ❌ Broken anchor in file: #${anchorPart} in [${linkText}]`
              );
            } else if (config.verbose) {
              console.log(`   ✅ File with anchor: ${linkPath}`);
            }
          } catch (err) {
            stats.brokenLinks++;
            stats.validLinks--;
            brokenLinks.push({
              file: filePath,
              linkText,
              linkPath,
              type: "File Access",
              targetFile: resolvedPath,
              error: `Cannot read target file: ${err.message}`,
            });
            console.log(`   ❌ Cannot read file: ${resolvedPath}`);
          }
        } else if (config.verbose) {
          console.log(`   ✅ File: ${linkPath}`);
        }
      } else {
        stats.brokenLinks++;
        brokenLinks.push({
          file: filePath,
          linkText,
          linkPath,
          type: "File",
          resolvedPath,
          error: `File not found: ${resolvedPath}`,
        });
        console.log(
          `   ❌ Broken file: ${linkPath} (resolved to: ${resolvedPath})`
        );
      }
    });
  } catch (err) {
    console.error(`Error processing ${filePath}: ${err.message}`);
  }
}

function findMarkdownFiles(dir) {
  const files = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !isExcluded(fullPath)) {
        files.push(...findMarkdownFiles(fullPath));
      } else if (
        stat.isFile() &&
        item.endsWith(".md") &&
        !isExcluded(fullPath)
      ) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}: ${err.message}`);
  }

  return files;
}

// Main execution
function main() {
  console.log("🔗 CLMS Documentation Link Validation");
  console.log("=====================================\n");

  const startTime = Date.now();
  const markdownFiles = findMarkdownFiles(config.rootPath);

  console.log(`📁 Found ${markdownFiles.length} markdown files\n`);

  markdownFiles.forEach(validateMarkdownLinks);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Print results
  console.log("\n📊 VALIDATION RESULTS");
  console.log("====================");
  console.log(`Files checked:     ${stats.filesChecked}`);
  console.log(`Total links:       ${stats.totalLinks}`);
  console.log(`External links:    ${stats.externalLinks}`);
  console.log(`Anchor links:      ${stats.anchorLinks}`);
  console.log(`Valid links:       ${stats.validLinks}`);
  console.log(`Broken links:      ${stats.brokenLinks}`);

  const healthPercentage =
    stats.totalLinks > 0
      ? ((stats.validLinks / stats.totalLinks) * 100).toFixed(2)
      : 100;
  console.log(`Link health:       ${healthPercentage}%`);
  console.log(`Duration:          ${duration}s`);

  // Print broken links details
  if (brokenLinks.length > 0) {
    console.log("\n❌ BROKEN LINKS DETAILS");
    console.log("========================");

    brokenLinks.forEach((broken, index) => {
      const relativeFile = path.relative(process.cwd(), broken.file);
      console.log(`\n${index + 1}. File: ${relativeFile}`);
      console.log(`   Link: [${broken.linkText}](${broken.linkPath})`);
      console.log(`   Type: ${broken.type}`);
      console.log(`   Error: ${broken.error}`);
      if (broken.targetFile) {
        console.log(
          `   Target: ${path.relative(process.cwd(), broken.targetFile)}`
        );
      }
    });
  }

  const shouldSaveReport = ["1", "true", "yes"].includes(
    (process.env.LINK_VALIDATION_SAVE_REPORT || "").toLowerCase()
  );

  if (shouldSaveReport) {
    const reportDir = "reports/link-validation";
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportFile = path.join(reportDir, `link-validation-${timestamp}.txt`);

    const reportContent = `CLMS Documentation Link Validation Report
Generated: ${new Date().toISOString()}
Duration: ${duration}s

SUMMARY
────────────────────────────────────────
Files checked:        ${stats.filesChecked}
Total links found:    ${stats.totalLinks}
External links:       ${stats.externalLinks}
Anchor links:         ${stats.anchorLinks}
Valid links:          ${stats.validLinks}
Broken links:         ${stats.brokenLinks}
Link health:          ${healthPercentage}%

BROKEN LINKS
────────────────────────────────────────
${brokenLinks
  .map(
    (link, index) =>
      `${index + 1}. File: ${path.relative(process.cwd(), link.file)}
   Link: [${link.linkText}](${link.linkPath})
   Type: ${link.type}
   Error: ${link.error}
   ${
     link.targetFile
       ? `Target: ${path.relative(process.cwd(), link.targetFile)}`
       : ""
   }`
  )
  .join("\n\n")}

END OF REPORT
`;

    fs.writeFileSync(reportFile, reportContent, "utf8");
    console.log(`\n📄 Report saved to: ${reportFile}`);
  } else {
    console.log(
      "\n💾 Report generation skipped. Set LINK_VALIDATION_SAVE_REPORT=true to enable saving reports."
    );
  }

  // Final status
  console.log("\n" + "=".repeat(50));
  if (brokenLinks.length === 0) {
    console.log("✅ ALL LINKS VALID - VALIDATION PASSED");
    process.exit(0);
  } else {
    console.log("❌ BROKEN LINKS FOUND - VALIDATION FAILED");
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { validateMarkdownLinks, findMarkdownFiles };
