#!/usr/bin/env node

/**
 * Fix Documentation Links Script
 * 
 * This script fixes common documentation link issues in the CLMS project.
 * It addresses path resolution problems and updates broken references.
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
    dryRun: false, // Set to true to preview changes without applying them
    verbose: true
};

// Common link fixes based on validation results
const linkFixes = {
    // Fix GitHub instruction links
    '.github/instructions/prisma.instructions.md': '.kilo/rules/prisma.md',
    '.github/instructions/vscode_rules.instructions.md': '.kilo/rules/kilo_rules.md',
    '.github/instructions/dev_workflow.instructions.md': '.kilo/rules/dev_workflow.md',
    
    // Fix Docs/ path issues (remove Docs/ prefix when file is in root)
    'Docs/README.md': 'README.md',
    'Docs/API_DOCUMENTATION.md': 'Docs/API_DOCUMENTATION.md', // Keep as is
    'Docs/USER_GUIDE.md': 'Docs/USER_GUIDE.md', // Keep as is
    'Docs/DEPLOYMENT_COMPREHENSIVE_GUIDE.md': 'Docs/DEPLOYMENT_COMPREHENSIVE_GUIDE.md',
    'Docs/SECURITY_COMPREHENSIVE_GUIDE.md': 'Docs/SECURITY_COMPREHENSIVE_GUIDE.md',
    'Docs/PERFORMANCE_COMPREHENSIVE_GUIDE.md': 'Docs/PERFORMANCE_COMPREHENSIVE_GUIDE.md',
    'Docs/DEVELOPER_QUICK_START_GUIDE.md': 'Docs/DEVELOPER_QUICK_START_GUIDE.md',
    'Docs/DOCUMENTATION_WORKFLOW_GUIDE.md': 'Docs/DOCUMENTATION_WORKFLOW_GUIDE.md',
    'Docs/DOCUMENTATION_TEMPLATE.md': 'Docs/DOCUMENTATION_TEMPLATE.md',
    'Docs/README_TEMPLATE.md': 'Docs/README_TEMPLATE.md',
    'Docs/MARKDOWN_STYLE_GUIDE.md': 'Docs/MARKDOWN_STYLE_GUIDE.md',
    'Docs/WRITING_STYLE_GUIDE.md': 'Docs/WRITING_STYLE_GUIDE.md',
    'Docs/CODE_COMMENT_STYLE_GUIDE.md': 'Docs/CODE_COMMENT_STYLE_GUIDE.md',
    'Docs/API_DOCUMENTATION_STYLE_GUIDE.md': 'Docs/API_DOCUMENTATION_STYLE_GUIDE.md',
    'Docs/USER_GUIDE_STYLE_GUIDE.md': 'Docs/USER_GUIDE_STYLE_GUIDE.md',
    'Docs/DOCUMENTATION_QUALITY_STANDARDS.md': 'Docs/DOCUMENTATION_QUALITY_STANDARDS.md',
    'Docs/SEC_DOCUMENTATION_ACCESS_POLICY.md': 'Docs/SEC_DOCUMENTATION_ACCESS_POLICY.md',
    'Docs/TYPEINFERENCE_SYSTEM_GUIDE.md': 'Docs/TYPEINFERENCE_SYSTEM_GUIDE.md',
    'Docs/WEBSOCKET_REALTIME_GUIDE.md': 'Docs/WEBSOCKET_REALTIME_GUIDE.md',
    'Docs/CONFIGURATION_GUIDE.md': 'Docs/CONFIGURATION_GUIDE.md',
    'Docs/INCIDENT_RESPONSE_PLAN.md': 'Docs/INCIDENT_RESPONSE_PLAN.md',
    'Docs/TEAM_GUIDELINES.md': 'Docs/TEAM_GUIDELINES.md',
    'Docs/ONBOARDING_CHECKLISTS.md': 'Docs/ONBOARDING_CHECKLISTS.md',
    'Docs/CONTACT_INFORMATION.md': 'Docs/CONTACT_INFORMATION.md',
    
    // Fix .kilo/rules links
    '.kilo/rules/prisma.md': '.kilo/rules/prisma.md',
    '.kilo/rules/kilo_rules.md': '.kilo/rules/kilo_rules.md',
    '.kilo/rules/dev_workflow.md': '.kilo/rules/dev_workflow.md',
    
    // Fix .windsurf/rules links
    '.windsurf/rules/prisma.md': '.windsurf/rules/prisma.md',
    '.windsurf/rules/windsurf_rules.md': '.windsurf/rules/windsurf_rules.md',
    '.windsurf/rules/dev_workflow.md': '.windsurf/rules/dev_workflow.md',
    
    // Fix archive directory links
    './RBAC_IMPLEMENTATION/': 'Docs/archive/RBAC_IMPLEMENTATION/',
    './TESTING_FRAMEWORK/': 'Docs/archive/TESTING_FRAMEWORK/',
    './AUDIT_REPORTS/': 'Docs/archive/AUDIT_REPORTS/',
    './SESSION_RECORDS/': 'Docs/archive/SESSION_RECORDS/',
    './ERROR_RESOLUTION/': 'Docs/archive/ERROR_RESOLUTION/',
    './UPGRADE_RECORDS/': 'Docs/archive/UPGRADE_RECORDS/',
    
    // Fix other common issues
    'CONTRIBUTING.md': 'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md': 'CODE_OF_CONDUCT.md',
    'DOCUMENTATION_INVENTORY.md': 'Docs/DOCUMENTATION_INVENTORY.md',
    'DOCUMENTATION_MAINTENANCE_PLAYBOOK.md': 'Docs/DOCUMENTATION_MAINTENANCE_PLAYBOOK.md',
    'DOCUMENTATION_AUDIT_INDEX.md': 'Docs/DOCUMENTATION_AUDIT_INDEX.md',
    'Backend/DOCKER_BUILD_GUIDE.md': 'Backend/DOCKER_BUILD_GUIDE.md',
    'Backend/docs/repository-pattern.md': 'Backend/docs/repository-pattern.md',
    'Frontend/docs/': 'Frontend/docs/',
    'Backend/docs/': 'Backend/docs/',
    'infrastructure/': 'infrastructure/'
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
            // Skip excluded directories
            if (config.excludeDirs.includes(file)) continue;
            findMarkdownFiles(filePath, fileList);
        } else if (file.match(/\.md$/)) {
            // Include files from root and specified directories
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
 * Fix links in a single file
 */
function fixLinksInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let changesCount = 0;
    
    // Apply each link fix
    for (const [oldLink, newLink] of Object.entries(linkFixes)) {
        // Fix markdown links: [text](oldLink)
        const linkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${oldLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
        const beforeCount = (modifiedContent.match(linkRegex) || []).length;
        modifiedContent = modifiedContent.replace(linkRegex, `[$1](${newLink})`);
        changesCount += beforeCount;
        
        // Fix reference links: [oldLink]: url
        const refRegex = new RegExp(`^\\[${oldLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]:\\s*(.+)$`, 'gm');
        const beforeRefCount = (modifiedContent.match(refRegex) || []).length;
        modifiedContent = modifiedContent.replace(refRegex, `[${newLink}]: $1`);
        changesCount += beforeRefCount;
    }
    
    // Fix common path patterns
    // Remove duplicate directory names (e.g., .github/instructions/.github/instructions/)
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\((\.github\/instructions\/)\.github\/instructions\/([^)]+)\)/g, `[$1]$2$3`);
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\((\.kilo\/rules\/)\.kilo\/rules\/([^)]+)\)/g, `[$1]$2$3`);
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\((\.windsurf\/rules\/)\.windsurf\/rules\/([^)]+)\)/g, `[$1]$2$3`);
    
    // Fix Docs/Docs/ double path issues
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/Docs\/([^)]+)\)/g, `[$1]Docs/$2`);
    
    // Fix GitHub issue template paths
    modifiedContent = modifiedContent.replace(/\[([^\]]+)\]\(Docs\/\.github\/([^)]+)\)/g, `[$1].github/$2`);
    
    return { content: modifiedContent, changesCount };
}

/**
 * Main execution function
 */
function main() {
    console.log('🔧 CLMS Documentation Link Fixer');
    console.log('==================================\n');
    
    if (config.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be applied\n');
    }
    
    // Find all markdown files
    const markdownFiles = findMarkdownFiles(config.rootPath);
    console.log(`📁 Found ${markdownFiles.length} markdown files to process\n`);
    
    let totalChanges = 0;
    let filesModified = 0;
    
    // Process each file
    for (const filePath of markdownFiles) {
        const relativePath = path.relative(config.rootPath, filePath);
        const result = fixLinksInFile(filePath);
        
        if (result.changesCount > 0) {
            console.log(`📝 ${relativePath}: ${result.changesCount} link(s) fixed`);
            
            if (!config.dryRun) {
                fs.writeFileSync(filePath, result.content, 'utf8');
                filesModified++;
            }
            
            totalChanges += result.changesCount;
        }
    }
    
    console.log('\n📊 SUMMARY');
    console.log('==========');
    console.log(`Total links fixed: ${totalChanges}`);
    console.log(`Files modified: ${config.dryRun ? 'Would be modified' : filesModified}`);
    
    if (config.dryRun) {
        console.log('\n💡 To apply these changes, set dryRun to false in the script');
    } else {
        console.log('\n✅ Link fixing completed!');
        console.log('💡 Run the validation script again to verify the fixes');
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { fixLinksInFile, linkFixes };