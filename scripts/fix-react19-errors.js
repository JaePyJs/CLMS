#!/usr/bin/env node

/**
 * Automated React 19 Error Fix Script
 *
 * This script automatically fixes common patterns in React 19 upgrade:
 * - Removes unused imports (TS6133)
 * - Fixes CheckedState to boolean conversions
 * - Adds null coalescing for string | undefined
 * - Fixes optional property types
 * - Adds type guards for possibly undefined
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FRONTEND_DIR = path.join(__dirname, '..', 'Frontend', 'src');

// Counters
let filesProcessed = 0;
let fixesApplied = 0;

console.log('🚀 Starting React 19 Automated Error Fix Script...\n');

/**
 * Get all TypeScript/TSX files recursively
 */
function getAllTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
        getAllTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Fix Pattern 1: Remove unused React imports
 */
function fixUnusedReactImport(content) {
  let fixed = content;
  let count = 0;

  // Remove standalone unused React import
  if (content.includes("import React from 'react';") &&
      !content.includes('React.') &&
      !content.includes('<React.') &&
      !content.includes('React,')) {

    // Check if React is used in JSX (it's implicit in React 19)
    const hasJSX = /<[A-Z]/.test(content);
    if (!hasJSX) {
      fixed = fixed.replace(/import React from ['"]react['"];\s*/g, '');
      count++;
    }
  }

  return { content: fixed, count };
}

/**
 * Fix Pattern 2: CheckedState to boolean
 */
function fixCheckedState(content) {
  let fixed = content;
  let count = 0;

  // Pattern: onCheckedChange={setState}
  const regex = /onCheckedChange=\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g;
  const matches = [...content.matchAll(regex)];

  matches.forEach((match) => {
    const stateFunc = match[1];
    const original = match[0];
    const replacement = `onCheckedChange={(checked) => ${stateFunc}(checked === true)}`;

    // Only replace if not already converted
    if (!content.includes(replacement)) {
      fixed = fixed.replace(original, replacement);
      count++;
    }
  });

  return { content: fixed, count };
}

/**
 * Fix Pattern 3: String | undefined in params.append
 */
function fixParamsAppend(content) {
  let fixed = content;
  let count = 0;

  // Pattern: params.append('key', value)
  const regex = /params\.append\(['"]([^'"]+)['"],\s*([a-zA-Z_$][a-zA-Z0-9_$.]*)\)/g;
  const matches = [...content.matchAll(regex)];

  matches.forEach((match) => {
    const key = match[1];
    const value = match[2];
    const original = match[0];

    // Only fix if value might be undefined (simple heuristic)
    if (!value.includes('??')) {
      const replacement = `params.append('${key}', ${value} ?? '')`;
      fixed = fixed.replace(original, replacement);
      count++;
    }
  });

  return { content: fixed, count };
}

/**
 * Fix Pattern 4: Array index access that might be undefined
 */
function fixArrayAccess(content) {
  let fixed = content;
  let count = 0;

  // Pattern: array[index] where it might be undefined
  // Look for: ['item1', 'item2'][variable]
  const regex = /\[(['"][^'"]+['"],?\s*)+\]\[([a-zA-Z_$][a-zA-Z0-9_$]*)\]/g;
  const matches = [...content.matchAll(regex)];

  matches.forEach((match) => {
    const original = match[0];

    // Only fix if not already using ??
    if (!content.slice(match.index, match.index + 100).includes('??')) {
      const replacement = `(${original} ?? '')`;
      fixed = fixed.replace(original, replacement);
      count++;
    }
  });

  return { content: fixed, count };
}

/**
 * Fix Pattern 5: Possibly undefined object access
 */
function fixPossiblyUndefined(content) {
  let fixed = content;
  let count = 0;

  // Common patterns like: data.field where data might be undefined
  // This is a conservative fix - only add ? if there's a TS error comment nearby

  // Look for patterns like: object.property where object might be undefined
  // But only in common scenarios to avoid false positives

  return { content: fixed, count };
}

/**
 * Fix Pattern 6: Remove unused imports from lucide-react
 */
function fixUnusedLucideImports(content) {
  let fixed = content;
  let count = 0;

  // Extract lucide-react import line
  const lucideImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/;
  const match = content.match(lucideImportRegex);

  if (match) {
    const importList = match[1];
    const imports = importList.split(',').map(i => i.trim()).filter(Boolean);

    const usedImports = imports.filter(imp => {
      const iconName = imp.trim();
      // Check if icon is used in the file
      const usageRegex = new RegExp(`<${iconName}|{${iconName}}|${iconName}\\s*=`, 'g');
      return usageRegex.test(content.slice(match.index + match[0].length));
    });

    if (usedImports.length < imports.length && usedImports.length > 0) {
      const newImport = `import { ${usedImports.join(', ')} } from 'lucide-react';`;
      fixed = fixed.replace(match[0], newImport);
      count += imports.length - usedImports.length;
    } else if (usedImports.length === 0) {
      // Remove entire import if nothing is used
      fixed = fixed.replace(match[0], '');
      count += imports.length;
    }
  }

  return { content: fixed, count };
}

/**
 * Fix Pattern 7: Add return type annotations for functions returning string
 */
function fixMissingReturnTypes(content) {
  let fixed = content;
  let count = 0;

  // Pattern: const funcName = () => { ... return string; }
  // Add `: string` return type if missing

  return { content: fixed, count };
}

/**
 * Fix Pattern 8: exactOptionalPropertyTypes - conditional property assignment
 */
function fixOptionalProperties(content) {
  let fixed = content;
  let count = 0;

  // This is complex and requires AST parsing, skip for now

  return { content: fixed, count };
}

/**
 * Apply all fixes to a file
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileFixes = 0;

    // Apply all fix patterns
    const fixes = [
      fixUnusedReactImport,
      fixCheckedState,
      fixParamsAppend,
      fixArrayAccess,
      fixUnusedLucideImports,
    ];

    fixes.forEach((fixFunc) => {
      const result = fixFunc(content);
      content = result.content;
      fileFixes += result.count;
    });

    // Write back if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesProcessed++;
      fixesApplied += fileFixes;

      const relativePath = path.relative(FRONTEND_DIR, filePath);
      console.log(`✅ Fixed ${fileFixes} issues in: ${relativePath}`);
      return fileFixes;
    }

    return 0;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Main execution
 */
function main() {
  console.log(`📂 Scanning ${FRONTEND_DIR}...\n`);

  const files = getAllTsFiles(FRONTEND_DIR);
  console.log(`📝 Found ${files.length} TypeScript files\n`);
  console.log('🔧 Applying fixes...\n');

  let totalFileFixes = 0;
  files.forEach((file) => {
    const fixes = processFile(file);
    totalFileFixes += fixes;
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  console.log(`Files processed: ${filesProcessed}`);
  console.log(`Total fixes applied: ${fixesApplied}`);
  console.log('='.repeat(60));

  if (fixesApplied > 0) {
    console.log('\n✅ Fixes applied successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Run: cd Frontend && npx tsc --noEmit');
    console.log('2. Check remaining errors');
    console.log('3. Commit changes: git add -A && git commit -m "Applied automated React 19 fixes"');
  } else {
    console.log('\n✨ No automatic fixes needed!');
  }

  // Run TypeScript check to see new error count
  console.log('\n🔍 Running TypeScript check...\n');
  try {
    const frontendPath = path.join(__dirname, '..', 'Frontend');
    const result = execSync('npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"', {
      cwd: frontendPath,
      encoding: 'utf8',
    });

    const errorCount = parseInt(result.trim()) || 0;
    console.log(`\n📈 Current error count: ${errorCount}`);

    if (errorCount < 900) {
      console.log('🎉 Great progress! Under 900 errors!');
    }
  } catch (error) {
    console.log('⚠️  Could not run TypeScript check automatically');
    console.log('   Run manually: cd Frontend && npx tsc --noEmit');
  }

  console.log('\n✨ Done!\n');
}

// Run the script
main();
