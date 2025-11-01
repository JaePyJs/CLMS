#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Broken Links Categorization Script
 * 
 * This script analyzes the broken links from the validation output
 * and categorizes them by issue type for targeted fixes.
 */

function categorizeBrokenLinks() {
  console.log('🔍 Analyzing and categorizing broken links...');
  
  // Read the latest validation report
  const reportsDir = 'docs/reports';
  const reportFiles = fs.readdirSync(reportsDir)
    .filter(file => file.startsWith('docs-validation-') && file.endsWith('.txt'))
    .sort()
    .reverse();
  
  if (reportFiles.length === 0) {
    console.log('❌ No validation reports found. Run validation first.');
    return;
  }
  
  const latestReport = path.join(reportsDir, reportFiles[0]);
  const reportContent = fs.readFileSync(latestReport, 'utf8');
  
  // Extract broken links from the report
  const brokenLinks = extractBrokenLinks(reportContent);
  
  // Categorize broken links
  const categories = {
    'double-docs-path': [],
    'archive-path': [],
    'github-template-path': [],
    'missing-file': [],
    'relative-path': [],
    'anchor-empty': [],
    'anchor-missing': [],
    'other': []
  };
  
  brokenLinks.forEach(link => {
    const category = categorizeLink(link);
    categories[category].push(link);
  });
  
  // Generate categorized report
  generateCategorizedReport(categories, brokenLinks.length);
  
  console.log('✅ Link categorization completed');
  console.log(`📊 Categorized ${brokenLinks.length} broken links into ${Object.keys(categories).length} categories`);
}

function extractBrokenLinks(reportContent) {
  const brokenLinks = [];
  const lines = reportContent.split('\n');
  let inBrokenSection = false;
  let currentEntry = {};
  
  for (const line of lines) {
    if (line.includes('❌ BROKEN LINKS DETAILS')) {
      inBrokenSection = true;
      continue;
    }
    
    if (line.includes('📄 Report saved to:')) {
      inBrokenSection = false;
      continue;
    }
    
    if (inBrokenSection) {
      // Parse the specific format from the validation script
      if (line.match(/^\s*\d+\.\s+File:/)) {
        // Start of a new entry
        if (currentEntry.file) {
          brokenLinks.push({...currentEntry});
        }
        currentEntry = {};
        const match = line.match(/^\s*\d+\.\s+File:\s+(.+)/);
        if (match) {
          currentEntry.file = match[1].trim();
        }
      } else if (line.match(/^\s+Link:/) && currentEntry.file) {
        const match = line.match(/^\s+Link:\s+(.+)/);
        if (match) {
          currentEntry.linkLine = match[1].trim();
          // Extract link text and URL
          const linkMatch = match[1].match(/\[([^\]]*)\]\(([^)]+)\)/);
          if (linkMatch) {
            currentEntry.text = linkMatch[1];
            currentEntry.link = linkMatch[2];
          } else {
            // Handle plain links
            currentEntry.text = match[1].trim();
            currentEntry.link = match[1].trim();
          }
        }
      } else if (line.match(/^\s+Error:/) && currentEntry.file) {
        const match = line.match(/^\s+Error:\s+(.+)/);
        if (match) {
          currentEntry.error = match[1].trim();
        }
      } else if (line.trim() === '' && currentEntry.file) {
        // End of entry
        brokenLinks.push({...currentEntry});
        currentEntry = {};
      }
    }
  }
  
  // Add the last entry if exists
  if (currentEntry.file) {
    brokenLinks.push({...currentEntry});
  }
  
  return brokenLinks;
}

function categorizeLink(link) {
  const { link: linkPath, file } = link;
  
  // Check for double Docs/ path
  if (linkPath.includes('Docs/Docs/')) {
    return 'double-docs-path';
  }
  
  // Check for archive path issues
  if (linkPath.includes('Docs/archive/') && !linkPath.includes('Docs/archive/INDEX.md')) {
    return 'archive-path';
  }
  
  // Check for GitHub template path issues
  if (linkPath.includes('Docs/.github/')) {
    return 'github-template-path';
  }
  
  // Check for empty anchors
  if (linkPath.endsWith('#')) {
    return 'anchor-empty';
  }
  
  // Check for anchor issues (contains # but not empty)
  if (linkPath.includes('#') && !linkPath.endsWith('#')) {
    return 'anchor-missing';
  }
  
  // Check for missing files in Docs/ directory
  if (linkPath.startsWith('Docs/') && !fs.existsSync(linkPath)) {
    return 'missing-file';
  }
  
  // Check for relative path issues
  if (linkPath.startsWith('../') || linkPath.startsWith('./')) {
    return 'relative-path';
  }
  
  // Default to other
  return 'other';
}

function generateCategorizedReport(categories, totalLinks) {
  const report = `# Broken Links Categorization Report

> Generated: ${new Date().toISOString()}
> Total Broken Links: ${totalLinks}

## Summary by Category

| Category | Count | Percentage |
|----------|-------|------------|
${Object.entries(categories)
  .map(([category, links]) => `| ${formatCategoryName(category)} | ${links.length} | ${(links.length / totalLinks * 100).toFixed(1)}% |`)
  .join('\n')}

## Detailed Breakdown

### 1. Double Docs/ Path Issues (${categories['double-docs-path'].length} links)

These links have redundant Docs/Docs/ paths that should be Docs/.

${categories['double-docs-path'].length > 0 ? 
  categories['double-docs-path'].map(link => `- **${link.file}**: \`${link.link}\``).join('\n') : 
  'No links in this category.'}

### 2. Archive Path Issues (${categories['archive-path'].length} links)

These links point to non-existent archive directories.

${categories['archive-path'].length > 0 ? 
  categories['archive-path'].map(link => `- **${link.file}**: \`${link.link}\``).join('\n') : 
  'No links in this category.'}

### 3. GitHub Template Path Issues (${categories['github-template-path'].length} links)

These links reference Docs/.github/ instead of .github/.

${categories['github-template-path'].length > 0 ? 
  categories['github-template-path'].map(link => `- **${link.file}**: \`${link.link}\``).join('\n') : 
  'No links in this category.'}

### 4. Missing Files (${categories['missing-file'].length} links)

These links point to files that don't exist.

${categories['missing-file'].length > 0 ? 
  categories['missing-file'].map(link => `- **${link.file}**: \`${link.link}\``).join('\n') : 
  'No links in this category.'}

### 5. Relative Path Issues (${categories['relative-path'].length} links)

These links have relative path problems.

${categories['relative-path'].length > 0 ? 
  categories['relative-path'].map(link => `- **${link.file}**: \`${link.link}\``).join('\n') : 
  'No links in this category.'}

### 6. Empty Anchors (${categories['anchor-empty'].length} links)

These links have empty anchors (#).

${categories['anchor-empty'].length > 0 ? 
  categories['anchor-empty'].map(link => `- **${link.file}**: \`${link.link}\``).join('\n') : 
  'No links in this category.'}

### 7. Missing Anchors (${categories['anchor-missing'].length} links)

These links reference anchors that don't exist.

${categories['anchor-missing'].length > 0 ? 
  categories['anchor-missing'].map(link => `- **${link.file}**: \`${link.link}\``).join('\n') : 
  'No links in this category.'}

### 8. Other Issues (${categories['other'].length} links)

Links that don't fit into other categories.

${categories['other'].length > 0 ? 
  categories['other'].map(link => `- **${link.file}**: \`${link.link}\``).join('\n') : 
  'No links in this category.'}

## Fix Strategy

### Priority 1: Quick Wins (High Impact, Low Effort)
1. **Double Docs/ Path Issues** - Global find and replace
2. **GitHub Template Path Issues** - Global find and replace
3. **Empty Anchors** - Remove or fix empty anchors

### Priority 2: Medium Effort
1. **Missing Files** - Create missing files or update links
2. **Archive Path Issues** - Update archive references
3. **Relative Path Issues** - Fix relative path calculations

### Priority 3: Detailed Review
1. **Missing Anchors** - Verify anchor existence and fix references
2. **Other Issues** - Manual review and case-by-case fixes

---

*This report was generated automatically to help prioritize link fixing efforts.*
`;

  // Save the categorized report
  const reportsDir = 'docs/reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportPath = path.join(reportsDir, `broken-links-categorization-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  fs.writeFileSync(reportPath, report, 'utf8');
  
  console.log(`📄 Categorized report saved to: ${reportPath}`);
}

function formatCategoryName(category) {
  const names = {
    'double-docs-path': 'Double Docs/ Path',
    'archive-path': 'Archive Path',
    'github-template-path': 'GitHub Template Path',
    'missing-file': 'Missing File',
    'relative-path': 'Relative Path',
    'anchor-empty': 'Empty Anchor',
    'anchor-missing': 'Missing Anchor',
    'other': 'Other'
  };
  return names[category] || category;
}

// Run the categorization
categorizeBrokenLinks();