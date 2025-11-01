#!/usr/bin/env node

/**
 * Fix Remaining Documentation Links Script
 * 
 * This script fixes the remaining complex link issues in the CLMS project.
 * It addresses path resolution problems that require more sophisticated handling.
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
 * Fix complex path resolution issues
 */
function fixComplexPaths(content, filePath) {
    const relativePath = path.relative(config.rootPath, filePath);
    const pathParts = relativePath.split(path.sep);
    let modifiedContent = content;
    
    // Fix 1: Remove duplicate Docs/ prefix when file is already in Docs directory
    if (pathParts[0] === 'Docs') {
        // Links like Docs/Docs/FILE.md should become Docs/FILE.md
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/Docs\/([^)]+)\)/g, `[$1]Docs/$2`);
        
        // Links like Docs/FILE.md when current file is in Docs/ should stay as is
        // But if they're resolving incorrectly, we need to adjust
    }
    
    // Fix 2: Handle GitHub issue template path resolution
    if (pathParts.includes('.github') && pathParts.includes('ISSUE_TEMPLATE')) {
        // These templates are in .github/ISSUE_TEMPLATE/ and should link to root files
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(README\.md\)/g, `[$1]../../README.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/([^)]+)\)/g, `[$1]../../Docs/$2`);
    }
    
    // Fix 3: Handle .kilo/rules and .windsurf/rules files linking to each other
    if (pathParts.includes('.kilo') && pathParts.includes('rules')) {
        // Files in .kilo/rules/ should link to other files in the same directory
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(\.kilo\/rules\/([^)]+)\)/g, `[$1]$2`);
    }
    
    if (pathParts.includes('.windsurf') && pathParts.includes('rules')) {
        // Files in .windsurf/rules/ should link to other files in the same directory
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(\.windsurf\/rules\/([^)]+)\)/g, `[$1]$2`);
    }
    
    // Fix 4: Handle .github/instructions files linking to .kilo/rules
    if (pathParts.includes('.github') && pathParts.includes('instructions')) {
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(\.kilo\/rules\/([^)]+)\)/g, `[$1]../../.kilo/rules/$2`);
    }
    
    // Fix 5: Handle archive directory links (remove double Docs/archive/)
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/archive\/Docs\/archive\/([^)]+)\)/g, `[$1]Docs/archive/$2`);
    
    // Fix 6: Handle links from Docs files to root files
    if (pathParts[0] === 'Docs') {
        // Links like README.md should become ../README.md
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(README\.md\)/g, `[$1]../README.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(CONTRIBUTING\.md\)/g, `[$1]../CONTRIBUTING.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(CODE_OF_CONDUCT\.md\)/g, `[$1]../CODE_OF_CONDUCT.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(DOCUMENTATION_INVENTORY\.md\)/g, `[$1]DOCUMENTATION_INVENTORY.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(DOCUMENTATION_MAINTENANCE_PLAYBOOK\.md\)/g, `[$1]DOCUMENTATION_MAINTENANCE_PLAYBOOK.md`);
        modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(DOCUMENTATION_AUDIT_INDEX\.md\)/g, `[$1]DOCUMENTATION_AUDIT_INDEX.md`);
    }
    
    // Fix 7: Handle links to missing files that should be created or are placeholders
    const placeholderLinks = {
        'Docs/CONFIGURATION_GUIDE.md': '# Configuration Guide\n\n*This guide is currently being developed.*',
        'Docs/INCIDENT_RESPONSE_PLAN.md': '# Incident Response Plan\n\n*This plan is currently being developed.*',
        'Docs/TEAM_GUIDELINES.md': '# Team Guidelines\n\n*These guidelines are currently being developed.*',
        'Docs/ONBOARDING_CHECKLISTS.md': '# Onboarding Checklists\n\n*These checklists are currently being developed.*',
        'Docs/CONTACT_INFORMATION.md': '# Contact Information\n\n*This information is currently being developed.*',
        'CONTRIBUTING.md': '# Contributing to CLMS\n\n*This guide is currently being developed.*'
    };
    
    // Fix 8: Remove or fix placeholder links like "internal-link", "path/to/file.md"
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(internal-link\)/g, `[$1](#)`);
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(path\/to\/file\.md\)/g, `[$1](#)`);
    
    // Fix 9: Handle code parameter links (uuid, studentId, etc.) - these should be code formatted
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\((uuid|studentId|accessionNo|qrCode)\)/g, '`$2`');
    
    return modifiedContent;
}

/**
 * Create missing documentation files
 */
function createMissingFiles() {
    const missingFiles = {
        'Docs/CONFIGURATION_GUIDE.md': `# Configuration Guide

## Overview
This guide covers the configuration aspects of the CLMS system.

## Environment Configuration
- Development environment setup
- Production environment configuration
- Environment variables

## System Configuration
- Database configuration
- API configuration
- Security settings

## Application Settings
- Feature flags
- User preferences
- System limits

*This guide is currently being developed. Please check back later for updates.*`,
        
        'Docs/INCIDENT_RESPONSE_PLAN.md': `# Incident Response Plan

## Overview
This document outlines the incident response procedures for the CLMS system.

## Incident Classification
- Critical
- High
- Medium
- Low

## Response Procedures
1. Detection
2. Assessment
3. Containment
4. Resolution
5. Post-incident review

## Contact Information
- System Administrator
- Development Team
- Stakeholders

*This plan is currently being developed. Please check back later for updates.*`,
        
        'CONTRIBUTING.md': `# Contributing to CLMS

## How to Contribute
We welcome contributions to the Centralized Library Management System!

## Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Code Standards
- Follow existing code style
- Add appropriate tests
- Update documentation

## Documentation
- Update relevant documentation
- Follow the documentation style guide
- Include examples where appropriate

*This guide is currently being developed. Please check back later for updates.*`
    };
    
    for (const [filePath, content] of Object.entries(missingFiles)) {
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
    console.log('🔧 CLMS Remaining Link Fixer');
    console.log('===============================\n');
    
    if (config.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be applied\n');
    }
    
    // Create missing files first
    createMissingFiles();
    
    // Find all markdown files
    const markdownFiles = findMarkdownFiles(config.rootPath);
    console.log(`📁 Found ${markdownFiles.length} markdown files to process\n`);
    
    let totalChanges = 0;
    let filesModified = 0;
    
    // Process each file
    for (const filePath of markdownFiles) {
        const relativePath = path.relative(config.rootPath, filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const modifiedContent = fixComplexPaths(content, filePath);
        
        if (content !== modifiedContent) {
            const changesCount = (content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length - 
                               (modifiedContent.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
            
            console.log(`📝 ${relativePath}: Complex path fixes applied`);
            
            if (!config.dryRun) {
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                filesModified++;
            }
            
            totalChanges += Math.abs(changesCount);
        }
    }
    
    console.log('\n📊 SUMMARY');
    console.log('==========');
    console.log(`Total changes: ${totalChanges}`);
    console.log(`Files modified: ${config.dryRun ? 'Would be modified' : filesModified}`);
    
    if (config.dryRun) {
        console.log('\n💡 To apply these changes, set dryRun to false in the script');
    } else {
        console.log('\n✅ Complex link fixing completed!');
        console.log('💡 Run the validation script again to verify the fixes');
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { fixComplexPaths, createMissingFiles };