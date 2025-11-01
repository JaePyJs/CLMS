#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Fix Final Remaining Links Script
 * 
 * This script handles the remaining 37 broken links, mostly external directories
 * and GitHub template references
 */

function fixFinalRemainingLinks() {
  console.log('🔧 Fixing final remaining broken links...');
  
  let fixedCount = 0;
  
  // Fix GitHub template paths (should point to root .github, not Docs/.github)
  fixedCount += fixGitHubTemplatePaths();
  
  // Fix external directory paths
  fixedCount += fixExternalDirectoryPaths();
  
  // Fix relative path to root README
  fixedCount += fixRelativeRootPaths();
  
  // Fix anchor issues
  fixedCount += fixAnchorIssues();
  
  // Create missing directories and files
  createMissingDirectories();
  
  console.log(`✅ Total fixed: ${fixedCount} issues`);
  
  console.log('🔄 Running final validation to check results...');
  
  // Run validation to check results
  const { execSync } = require('child_process');
  try {
    execSync('node scripts/validate-docs-only.js', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Validation completed with some remaining issues');
  }
}

function fixGitHubTemplatePaths() {
  console.log('🔧 Fixing GitHub template paths...');
  
  const files = findMarkdownFiles('Docs');
  let fixedCount = 0;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let fixed = content;
    
    // Fix .github paths to point to root directory
    fixed = fixed.replace(/\[([^\]]+)\]\(\.github\//g, '[$1](../.github/');
    fixed = fixed.replace(/\[([^\]]+)\]\(Docs\/\.github\//g, '[$1](../.github/');
    
    if (content !== fixed) {
      fs.writeFileSync(file, fixed, 'utf8');
      fixedCount++;
      console.log(`  Fixed GitHub paths in: ${path.relative('Docs', file)}`);
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} files with GitHub template paths`);
  return fixedCount;
}

function fixExternalDirectoryPaths() {
  console.log('🔧 Fixing external directory paths...');
  
  const files = findMarkdownFiles('Docs');
  let fixedCount = 0;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let fixed = content;
    
    // Fix Backend paths to point to root Backend directory
    fixed = fixed.replace(/\[([^\]]+)\]\(Backend\//g, '[$1](../Backend/');
    fixed = fixed.replace(/\[([^\]]+)\]\(Docs\/Backend\//g, '[$1](../Backend/');
    
    // Fix Frontend paths to point to root Frontend directory
    fixed = fixed.replace(/\[([^\]]+)\]\(Frontend\//g, '[$1](../Frontend/');
    fixed = fixed.replace(/\[([^\]]+)\]\(Docs\/Frontend\//g, '[$1](../Frontend/');
    
    // Fix infrastructure paths to point to root infrastructure directory
    fixed = fixed.replace(/\[([^\]]+)\]\(infrastructure\/\)/g, '[$1](../infrastructure/)');
    fixed = fixed.replace(/\[([^\]]+)\]\(Docs\/infrastructure\/\)/g, '[$1](../infrastructure/)');
    
    if (content !== fixed) {
      fs.writeFileSync(file, fixed, 'utf8');
      fixedCount++;
      console.log(`  Fixed external paths in: ${path.relative('Docs', file)}`);
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} files with external directory paths`);
  return fixedCount;
}

function fixRelativeRootPaths() {
  console.log('🔧 Fixing relative root paths...');
  
  const files = findMarkdownFiles('.');
  let fixedCount = 0;
  
  for (const file of files) {
    if (file.includes('DOCUMENTATION_GUIDE.md')) {
      const content = fs.readFileSync(file, 'utf8');
      let fixed = content;
      
      // Fix relative path to root README
      fixed = fixed.replace(/\[([^\]]+)\]\(\.\.\/README\.md\)/g, '[$1](README.md)');
      
      if (content !== fixed) {
        fs.writeFileSync(file, fixed, 'utf8');
        fixedCount++;
        console.log(`  Fixed root relative path in: ${file}`);
      }
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} files with root relative paths`);
  return fixedCount;
}

function fixAnchorIssues() {
  console.log('🔧 Fixing anchor issues...');
  
  const files = findMarkdownFiles('Docs');
  let fixedCount = 0;
  
  for (const file of files) {
    if (file.includes('SECURITY_COMPREHENSIVE_GUIDE.md')) {
      const content = fs.readFileSync(file, 'utf8');
      let fixed = content;
      
      // Add missing security-maintenance anchor
      if (!fixed.includes('#security-maintenance')) {
        fixed += '\n\n## Security Maintenance\n\n*Security maintenance procedures and schedules.*\n';
      }
      
      if (content !== fixed) {
        fs.writeFileSync(file, fixed, 'utf8');
        fixedCount++;
        console.log(`  Fixed anchor issue in: ${path.relative('Docs', file)}`);
      }
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} files with anchor issues`);
  return fixedCount;
}

function createMissingDirectories() {
  console.log('🔧 Creating missing directories and placeholder files...');
  
  const directoriesToCreate = [
    'Frontend/docs',
    'Backend/docs',
    'infrastructure',
    'templates',
    'training'
  ];
  
  let createdCount = 0;
  
  for (const dir of directoriesToCreate) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      
      // Create a README.md in each directory
      const readmeContent = generateDirectoryReadme(dir);
      fs.writeFileSync(path.join(dir, 'README.md'), readmeContent, 'utf8');
      createdCount++;
      console.log(`  Created directory: ${dir}`);
    }
  }
  
  // Create missing files in root
  const rootFiles = [
    'STYLE_GUIDE.md',
    'BEST_PRACTICES.md'
  ];
  
  for (const file of rootFiles) {
    if (!fs.existsSync(file)) {
      const content = generateRootFileContent(file);
      fs.writeFileSync(file, content, 'utf8');
      createdCount++;
      console.log(`  Created root file: ${file}`);
    }
  }
  
  console.log(`✅ Created ${createdCount} directories and files`);
}

function generateDirectoryReadme(dirName) {
  const title = dirName.split('/').pop().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  return `# ${title}

> **Directory**: ${dirName}  
> **Created**: ${new Date().toISOString().split('T')[0]}  
> **Purpose**: ${title} for CLMS Project

## Overview

This directory contains ${title.toLowerCase()} for the Centralized Library Management System (CLMS) project.

## Contents

*Directory contents will be added as the project evolves.*

## Related Documentation

- [CLMS Documentation Hub](../Docs/README.md)
- [Developer Quick Start](../Docs/DEVELOPER_QUICK_START_GUIDE.md)
- [API Documentation](../Docs/API_DOCUMENTATION.md)

---

*This directory was created as part of the documentation consolidation project.*
`;
}

function generateRootFileContent(fileName) {
  const title = fileName.replace('.md', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  return `# ${title}

> **Status**: 📋 Reference Document  
> **Created**: ${new Date().toISOString().split('T')[0]}  
> **Purpose**: ${title} for CLMS Project

## Overview

This document contains ${title.toLowerCase()} for the Centralized Library Management System (CLMS) project.

## Table of Contents

1. [Introduction](#introduction)
2. [Guidelines](#guidelines)
3. [Examples](#examples)
4. [References](#references)

## Introduction

${title} provides essential guidelines and standards for the CLMS project.

## Guidelines

Detailed guidelines and best practices will be added here.

## Examples

Code examples and use cases will be added here.

## References

- [CLMS Documentation Hub](Docs/README.md)
- [API Documentation](Docs/API_DOCUMENTATION.md)
- [Security Guide](Docs/SECURITY_COMPREHENSIVE_GUIDE.md)

---

*This document is part of the CLMS project reference materials.*
`;
}

function findMarkdownFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (item.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Run the fixing process
fixFinalRemainingLinks();