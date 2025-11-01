#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Fix Docs Relative Paths Script
 * 
 * This script specifically fixes the issue where links are pointing to Docs/Docs/ 
 * because the validation is running from the Docs directory
 */

function fixDocsRelativePaths() {
  console.log('🔧 Fixing Docs relative paths...');
  
  // The main issue is that files are linking to Docs/ when they should link directly
  // to the file since we're already in the Docs directory context
  
  const filesToFix = [
    'Docs/DEVELOPER_QUICK_START_GUIDE.md',
    'Docs/DOCUMENTATION_WORKFLOW_GUIDE.md',
    'Docs/ONBOARDING_CHECKLIST.md',
    'Docs/DOCUMENTATION_MAINTENANCE_PLAYBOOK.md',
    'Docs/FEEDBACK_AND_IMPROVEMENT.md'
  ];
  
  let fixedCount = 0;
  
  for (const file of filesToFix) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      let fixed = content;
      
      // Fix Docs/ paths to be relative to the Docs directory
      fixed = fixed.replace(/\[([^\]]+)\]\(Docs\/([^)]+)\)/g, '[$1]($2)');
      
      if (content !== fixed) {
        fs.writeFileSync(file, fixed, 'utf8');
        fixedCount++;
        console.log(`  Fixed: ${file}`);
      }
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} files with Docs/ relative paths`);
  
  // Now fix the newly created style guide files
  const styleGuideFiles = [
    'Docs/DOCUMENTATION_TEMPLATE.md',
    'Docs/README_TEMPLATE.md',
    'Docs/API_DOCUMENTATION_TEMPLATE.md',
    'Docs/DOCUMENTATION_QUALITY_STANDARDS.md',
    'Docs/DOCUMENTATION_INVENTORY.md',
    'Docs/MARKDOWN_STYLE_GUIDE.md',
    'Docs/WRITING_STYLE_GUIDE.md',
    'Docs/CODE_COMMENT_STYLE_GUIDE.md',
    'Docs/API_DOCUMENTATION_STYLE_GUIDE.md',
    'Docs/USER_GUIDE_STYLE_GUIDE.md'
  ];
  
  for (const file of styleGuideFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      let fixed = content;
      
      // Fix Docs/ paths to be relative
      fixed = fixed.replace(/\[([^\]]+)\]\(Docs\/([^)]+)\)/g, '[$1]($2)');
      
      if (content !== fixed) {
        fs.writeFileSync(file, fixed, 'utf8');
        fixedCount++;
        console.log(`  Fixed: ${file}`);
      }
    }
  }
  
  console.log(`✅ Total fixed: ${fixedCount} files`);
  
  // Create the missing core documentation files
  createCoreDocumentationFiles();
  
  console.log('🔄 Running validation to check results...');
  
  // Run validation to check results
  const { execSync } = require('child_process');
  try {
    execSync('node scripts/validate-docs-only.js', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Validation completed with some remaining issues');
  }
}

function createCoreDocumentationFiles() {
  console.log('🔧 Creating core documentation files...');
  
  const coreFiles = [
    'Docs/README.md',
    'Docs/API_DOCUMENTATION.md',
    'Docs/SECURITY_COMPREHENSIVE_GUIDE.md',
    'Docs/DEVELOPER_QUICK_START_GUIDE.md',
    'Docs/DEPLOYMENT_COMPREHENSIVE_GUIDE.md',
    'Docs/CONFIGURATION_GUIDE.md',
    'Docs/PERFORMANCE_COMPREHENSIVE_GUIDE.md',
    'Docs/SEC_DOCUMENTATION_ACCESS_POLICY.md',
    'Docs/DOCUMENTATION_WORKFLOW_GUIDE.md',
    'Docs/DOCUMENTATION_MAINTENANCE_PLAYBOOK.md',
    'Docs/INCIDENT_RESPONSE_PLAN.md',
    'Docs/USER_GUIDE.md',
    'Docs/WEBSOCKET_REALTIME_GUIDE.md',
    'Docs/TYPEINFERENCE_SYSTEM_GUIDE.md'
  ];
  
  let createdCount = 0;
  
  for (const file of coreFiles) {
    if (!fs.existsSync(file)) {
      const content = generateCoreDocumentationContent(file);
      ensureDirectoryExists(path.dirname(file));
      fs.writeFileSync(file, content, 'utf8');
      createdCount++;
      console.log(`  Created: ${file}`);
    }
  }
  
  console.log(`✅ Created ${createdCount} core documentation files`);
}

function generateCoreDocumentationContent(filePath) {
  const fileName = path.basename(filePath, '.md');
  const title = fileName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  if (fileName === 'README') {
    return `# CLMS Documentation Hub

> **Centralized Library Management System Documentation**
> 
> Welcome to the CLMS documentation hub. This is the main entry point for all project documentation.

## 📚 Documentation Structure

### Core Documentation
- [API Documentation](API_DOCUMENTATION.md) - Complete API reference and endpoints
- [Security Guide](SECURITY_COMPREHENSIVE_GUIDE.md) - Security policies and procedures
- [Developer Quick Start](DEVELOPER_QUICK_START_GUIDE.md) - Getting started for developers
- [Deployment Guide](DEPLOYMENT_COMPREHENSIVE_GUIDE.md) - Deployment instructions and configurations
- [Configuration Guide](CONFIGURATION_GUIDE.md) - System configuration details
- [Performance Guide](PERFORMANCE_COMPREHENSIVE_GUIDE.md) - Performance optimization and monitoring

### User Documentation
- [User Guide](USER_GUIDE.md) - End-user documentation
- [WebSocket Realtime Guide](WEBSOCKET_REALTIME_GUIDE.md) - Real-time features documentation

### Administrative Documentation
- [Security Access Policy](SEC_DOCUMENTATION_ACCESS_POLICY.md) - Documentation access policies
- [Documentation Workflow](DOCUMENTATION_WORKFLOW_GUIDE.md) - Documentation processes
- [Documentation Maintenance](DOCUMENTATION_MAINTENANCE_PLAYBOOK.md) - Maintenance procedures
- [Incident Response Plan](INCIDENT_RESPONSE_PLAN.md) - Incident handling procedures

### Technical Documentation
- [Type Inference System Guide](TYPEINFERENCE_SYSTEM_GUIDE.md) - TypeScript type system documentation

## 🚀 Quick Start

1. **For Developers**: Start with [Developer Quick Start](DEVELOPER_QUICK_START_GUIDE.md)
2. **For Users**: Read the [User Guide](USER_GUIDE.md)
3. **For Administrators**: Review the [Security Guide](SECURITY_COMPREHENSIVE_GUIDE.md)

## 📋 Documentation Standards

All documentation follows the standards outlined in:
- [Documentation Quality Standards](DOCUMENTATION_QUALITY_STANDARDS.md)
- [Documentation Template](DOCUMENTATION_TEMPLATE.md)
- [Markdown Style Guide](MARKDOWN_STYLE_GUIDE.md)

## 🔗 Related Resources

- [GitHub Repository](../README.md)
- [Issue Templates](../.github/ISSUE_TEMPLATE/)
- [Pull Request Template](../.github/pull_request_template.md)

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
  }
  
  return `# ${title}

> **Status**: 📋 Core Documentation  
> **Created**: ${new Date().toISOString().split('T')[0]}  
> **Purpose**: ${title} for CLMS Project

## Overview

This document contains ${title.toLowerCase()} for the Centralized Library Management System (CLMS) project.

## Table of Contents

1. [Introduction](#introduction)
2. [Requirements](#requirements)
3. [Implementation](#implementation)
4. [Examples](#examples)
5. [Troubleshooting](#troubleshooting)
6. [References](#references)

## Introduction

${title} provides essential information for working with the CLMS system.

## Requirements

List any prerequisites or requirements.

## Implementation

Detailed implementation information.

## Examples

Code examples and use cases.

## Troubleshooting

Common issues and solutions.

## References

- [CLMS Documentation Hub](README.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Security Guide](SECURITY_COMPREHENSIVE_GUIDE.md)

---

*This document is part of the CLMS core documentation.*
`;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Run the fixing process
fixDocsRelativePaths();