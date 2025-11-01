#!/usr/bin/env node

/**
 * Focused documentation link validation for CLMS project only
 * Created: October 18, 2025
 * Purpose: Validate links in project documentation, excluding node_modules
 */

const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    rootPath: '.',
    includeDirs: ['Docs', 'Backend', 'Frontend', 'Training', 'scripts', 'infrastructure', '.github', '.kilo', '.windsurf'],
    includeRoot: true, // Include root-level markdown files
    includeFiles: ['*.md'],
    excludeDirs: ['node_modules', 'dist', 'build', '.git', '.vscode', 'playwright-report'],
    excludeFiles: ['.DS_Store', '*.log', '*.tmp'],
    verbose: false
};

// Statistics
const stats = {
    filesChecked: 0,
    totalLinks: 0,
    validLinks: 0,
    brokenLinks: 0,
    externalLinks: 0,
    anchorLinks: 0
};

const brokenLinks = [];

// Utility functions
function isIncluded(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Check if not in excluded directories
    const isExcluded = config.excludeDirs.some(dir =>
        normalizedPath.includes(`/${dir}/`) || normalizedPath.startsWith(`${dir}/`)
    );
    
    if (isExcluded) return false;
    
    // Check if in included directories
    const isIncludedDir = config.includeDirs.some(dir =>
        normalizedPath.includes(`/${dir}/`) || normalizedPath.startsWith(`${dir}/`)
    );
    
    // Include root-level files if configured
    const isRootFile = !normalizedPath.includes('/');
    
    return isIncludedDir || (config.includeRoot && isRootFile);
}

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function resolveLinkPath(linkPath, currentFileDir) {
    if (path.isAbsolute(linkPath)) {
        return linkPath;
    }
    
    const cleanPath = linkPath.split('#')[0]; // Remove anchor
    return path.resolve(currentFileDir, cleanPath);
}

function extractAnchors(content) {
    const anchors = new Set();
    const headingRegex = /^#+\s+(.+)$/gm;
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
        const heading = match[1].trim();
        const anchor = heading.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        anchors.add(anchor);
    }
    
    return anchors;
}

function validateMarkdownLinks(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileDir = path.dirname(filePath);
        const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
        
        stats.filesChecked++;
        stats.totalLinks += links.length;
        
        if (config.verbose) {
            console.log(`\n📄 Processing: ${path.relative(process.cwd(), filePath)}`);
            console.log(`   Found ${links.length} links`);
        }
        
        const anchors = extractAnchors(content);
        
        links.forEach(link => {
            const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (!match) return;
            
            const [, linkText, linkPath] = match;
            
            // Skip special links
            if (linkPath.startsWith('mdc:') || linkPath.startsWith('#') && linkPath.includes('--')) {
                if (config.verbose) {
                    console.log(`   ⏭️  Skipping special link: ${linkPath}`);
                }
                return;
            }
            
            // External links
            if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
                stats.externalLinks++;
                stats.validLinks++;
                if (config.verbose) {
                    console.log(`   🔗 External: ${linkPath}`);
                }
                return;
            }
            
            // Anchor links
            if (linkPath.startsWith('#')) {
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
                        type: 'Anchor',
                        error: `Anchor #${anchor} not found in document`
                    });
                    console.log(`   ❌ Broken anchor: #${anchor} in [${linkText}]`);
                }
                return;
            }
            
            // Internal file links
            const resolvedPath = resolveLinkPath(linkPath, fileDir);
            const anchorPart = linkPath.includes('#') ? linkPath.split('#')[1] : null;
            
            if (fs.existsSync(resolvedPath)) {
                stats.validLinks++;
                
                // Check anchor if present
                if (anchorPart) {
                    try {
                        const targetContent = fs.readFileSync(resolvedPath, 'utf8');
                        const targetAnchors = extractAnchors(targetContent);
                        
                        if (!targetAnchors.has(anchorPart)) {
                            stats.brokenLinks++;
                            stats.validLinks--; // Remove the valid count
                            brokenLinks.push({
                                file: filePath,
                                linkText,
                                linkPath,
                                type: 'Anchor in File',
                                targetFile: resolvedPath,
                                error: `Anchor #${anchorPart} not found in target file`
                            });
                            console.log(`   ❌ Broken anchor in file: #${anchorPart} in [${linkText}]`);
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
                            type: 'File Access',
                            targetFile: resolvedPath,
                            error: `Cannot read target file: ${err.message}`
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
                    type: 'File',
                    resolvedPath,
                    error: `File not found: ${resolvedPath}`
                });
                console.log(`   ❌ Broken file: ${linkPath} (resolved to: ${resolvedPath})`);
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
            
            if (stat.isDirectory()) {
                if (isIncluded(fullPath)) {
                    files.push(...findMarkdownFiles(fullPath));
                }
            } else if (stat.isFile() && item.endsWith('.md') && isIncluded(fullPath)) {
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
    console.log('🔗 CLMS Project Documentation Link Validation');
    console.log('================================================\n');
    
    const startTime = Date.now();
    const markdownFiles = findMarkdownFiles(config.rootPath);
    
    console.log(`📁 Found ${markdownFiles.length} project markdown files\n`);
    
    markdownFiles.forEach(validateMarkdownLinks);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Print results
    console.log('\n📊 VALIDATION RESULTS');
    console.log('====================');
    console.log(`Files checked:     ${stats.filesChecked}`);
    console.log(`Total links:       ${stats.totalLinks}`);
    console.log(`External links:    ${stats.externalLinks}`);
    console.log(`Anchor links:      ${stats.anchorLinks}`);
    console.log(`Valid links:       ${stats.validLinks}`);
    console.log(`Broken links:      ${stats.brokenLinks}`);
    
    const healthPercentage = stats.totalLinks > 0 ? 
        ((stats.validLinks / stats.totalLinks) * 100).toFixed(2) : 100;
    console.log(`Link health:       ${healthPercentage}%`);
    console.log(`Duration:          ${duration}s`);
    
    // Print broken links details
    if (brokenLinks.length > 0) {
        console.log('\n❌ BROKEN LINKS DETAILS');
        console.log('========================');
        
        // Group by type
        const grouped = brokenLinks.reduce((acc, link) => {
            if (!acc[link.type]) acc[link.type] = [];
            acc[link.type].push(link);
            return acc;
        }, {});
        
        Object.entries(grouped).forEach(([type, links]) => {
            console.log(`\n${type} (${links.length}):`);
            links.forEach((link, index) => {
                const relativeFile = path.relative(process.cwd(), link.file);
                console.log(`  ${index + 1}. ${relativeFile}: [${link.linkText}](${link.linkPath})`);
            });
        });
    }
    
    // Save report
    const reportDir = 'docs/reports';
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `docs-validation-${timestamp}.txt`);
    
    const reportContent = `CLMS Project Documentation Link Validation Report
Generated: ${new Date().toISOString()}
Duration: ${duration}s
Scope: Project documentation only (excluded node_modules)

SUMMARY
────────────────────────────────────────
Files checked:        ${stats.filesChecked}
Total links found:    ${stats.totalLinks}
External links:       ${stats.externalLinks}
Anchor links:         ${stats.anchorLinks}
Valid links:          ${stats.validLinks}
Broken links:         ${stats.brokenLinks}
Link health:          ${healthPercentage}%

BROKEN LINKS BY TYPE
────────────────────────────────────────
${Object.entries(brokenLinks.reduce((acc, link) => {
    if (!acc[link.type]) acc[link.type] = [];
    acc[link.type].push(link);
    return acc;
}, {})).map(([type, links]) => 
`${type} (${links.length}):
${links.map((link, index) => 
`  ${index + 1}. File: ${path.relative(process.cwd(), link.file)}
     Link: [${link.linkText}](${link.linkPath})
     Error: ${link.error}
     ${link.targetFile ? `Target: ${path.relative(process.cwd(), link.targetFile)}` : ''}`
).join('\n')}`
).join('\n\n')}

END OF REPORT
`;
    
    fs.writeFileSync(reportFile, reportContent, 'utf8');
    console.log(`\n📄 Report saved to: ${reportFile}`);
    
    // Final status
    console.log('\n' + '='.repeat(50));
    if (brokenLinks.length === 0) {
        console.log('✅ ALL PROJECT LINKS VALID - VALIDATION PASSED');
        process.exit(0);
    } else {
        console.log(`❌ ${brokenLinks.length} BROKEN LINKS FOUND - VALIDATION FAILED`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { validateMarkdownLinks, findMarkdownFiles };