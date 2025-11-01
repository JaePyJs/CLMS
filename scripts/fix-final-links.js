#!/usr/bin/env node

/**
 * Fix Final Documentation Links Script
 * 
 * This script addresses the remaining link issues in the CLMS project.
 * It focuses on GitHub template paths and remaining Docs/ path issues.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    rootPath: '.',
    includeDirs: ['Docs', 'Backend', 'Frontend', 'Training', 'scripts', 'infrastructure', '.github', '.kilo', '.windsurf'],
    includeRoot: true,
    includeFiles: ['*.md'],
    excludeDirs: ['node_modules', 'dist', 'build', '.git', '.vscode', 'playwright-report'],
    excludeFiles: ['.DS_Store', '*.log', '*.tmp'],
    dryRun: false,
    verbose: true
};

/**
 * Find all markdown files in the project
 */
function findMarkdownFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            if (config.excludeDirs.includes(file)) continue;
            findMarkdownFiles(filePath, fileList);
        } else if (file.match(/\.md$/)) {
            const relativePath = path.relative(config.rootPath, filePath);
            const pathParts = relativePath.split(path.sep);
            
            if (config.includeRoot || pathParts.length > 1 && config.includeDirs.includes(pathParts[0])) {
                fileList.push(filePath);
            }
        }
    }
    
    return fileList;
}

/**
 * Fix final remaining link issues
 */
function fixFinalLinks(content, filePath) {
    const relativePath = path.relative(config.rootPath, filePath);
    const pathParts = relativePath.split(path.sep);
    let modifiedContent = content;
    
    // Fix 1: GitHub issue templates - fix all Docs/ links to go up two levels
    if (pathParts.includes('.github') && pathParts.includes('ISSUE_TEMPLATE')) {
        // Convert Docs/FILE.md to ../../Docs/FILE.md
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/([^)]+)\)/g, `[$1]../../Docs/$2`);
        
        // Convert README.md to ../../README.md
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(README\.md\)/g, `[$1]../../README.md`);
        
        // Convert plain Docs/ to ../../Docs/
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/\)/g, `[$1](../../Docs/)`);
    }
    
    // Fix 2: GitHub pull request template - same as issue templates
    if (pathParts.includes('.github') && pathParts.includes('pull_request_template.md')) {
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/([^)]+)\)/g, `[$1]../Docs/$2`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(README\.md\)/g, `[$1]../README.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/\)/g, `[$1](../Docs/)`);
    }
    
    // Fix 3: Remove remaining Docs/Docs/ double paths
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/Docs\/([^)]+)\)/g, `[$1]Docs/$2`);
    
    // Fix 4: Fix docs/ (lowercase) paths to Docs/ (uppercase) for consistency
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(docs\/([^)]+)\)/g, `[$1]Docs/$2`);
    
    // Fix 5: Handle relative paths from Docs files to root files
    if (pathParts[0] === 'Docs') {
        // Links to root files should use ../
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(\.\.\/README\.md\)/g, `[$1]../README.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(\.\.\/CONTRIBUTING\.md\)/g, `[$1]../CONTRIBUTING.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(\.\.\/CODE_OF_CONDUCT\.md\)/g, `[$1]../CODE_OF_CONDUCT.md`);
    }
    
    // Fix 6: Remove placeholder links that should be removed
    const placeholderPatterns = [
        /\[([^\]]+)\]\(Docs\/TEAM_GUIDELINES\.md\)/g,
        /\[([^\]]+)\]\(Docs\/ONBOARDING_CHECKLISTS\.md\)/g,
        /\[([^\]]+)\]\(Docs\/CONTACT_INFORMATION\.md\)/g,
        /\[([^\]]+)\]\(Docs\/DOCUMENTATION_AUDIT_INDEX\.md\)/g
    ];
    
    for (const pattern of placeholderPatterns) {
        modifiedContent = modifiedContent.replace(pattern, `[$1](#)`);
    }
    
    return modifiedContent;
}

/**
 * Create remaining missing documentation files
 */
function createRemainingFiles() {
    const remainingFiles = {
        'Docs/TEAM_GUIDELINES.md': `# Team Guidelines

## Overview
This document outlines the guidelines and best practices for the CLMS development team.

## Communication
- Team meetings schedule
- Communication channels
- Code review process

## Development Standards
- Coding conventions
- Testing requirements
- Documentation standards

## Collaboration
- Branch management
- Pull request process
- Issue tracking

*This guide is currently being developed. Please check back later for updates.*`,
        
        'Docs/ONBOARDING_CHECKLISTS.md': `# Onboarding Checklists

## New Developer Onboarding
- Environment setup
- Repository access
- Development tools installation

## System Orientation
- Architecture overview
- Codebase walkthrough
- Documentation review

## First Tasks
- Bug fix assignment
- Feature development
- Code review participation

*This checklist is currently being developed. Please check back later for updates.*`,
        
        'Docs/CONTACT_INFORMATION.md': `# Contact Information

## Development Team
- Project Lead: [Name]
- Backend Developer: [Name]
- Frontend Developer: [Name]
- DevOps Engineer: [Name]

## Support Contacts
- System Administrator: [Name]
- Database Administrator: [Name]
- Security Officer: [Name]

## External Contacts
- Library Management: [Name]
- IT Support: [Name]

*This information is currently being developed. Please check back later for updates.*`
    };
    
    for (const [filePath, content] of Object.entries(remainingFiles)) {
        const fullPath = path.join(config.rootPath, filePath);
        if (!fs.existsSync(fullPath)) {
            console.log(`📝 Creating missing file: ${filePath}`);
            if (!config.dryRun) {
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}

/**
 * Main execution function
 */
function main() {
    console.log('🔧 CLMS Final Link Fixer');
    console.log('==========================\n');
    
    if (config.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be applied\n');
    }
    
    // Create remaining missing files
    createRemainingFiles();
    
    // Find all markdown files
    const markdownFiles = findMarkdownFiles(config.rootPath);
    console.log(`📁 Found ${markdownFiles.length} markdown files to process\n`);
    
    let totalChanges = 0;
    let filesModified = 0;
    
    // Process each file
    for (const filePath of markdownFiles) {
        const relativePath = path.relative(config.rootPath, filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const modifiedContent = fixFinalLinks(content, filePath);
        
        if (content !== modifiedContent) {
            console.log(`📝 ${relativePath}: Final link fixes applied`);
            
            if (!config.dryRun) {
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                filesModified++;
            }
            
            totalChanges++;
        }
    }
    
    console.log('\n📊 SUMMARY');
    console.log('==========');
    console.log(`Total changes: ${totalChanges}`);
    console.log(`Files modified: ${config.dryRun ? 'Would be modified' : filesModified}`);
    
    if (config.dryRun) {
        console.log('\n💡 To apply these changes, set dryRun to false in the script');
    } else {
        console.log('\n✅ Final link fixing completed!');
        console.log('💡 Run the validation script again to verify the fixes');
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { fixFinalLinks, createRemainingFiles };