#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Comprehensive Codebase Error Analysis Script
 * 
 * This script analyzes the entire CLMS codebase to identify and categorize errors
 * across frontend, backend, and infrastructure components
 */

function analyzeCodebaseErrors() {
  console.log('🔍 Starting comprehensive codebase error analysis...');
  
  const analysisResults = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: 0,
      errorFiles: 0,
      warningFiles: 0,
      totalErrors: 0,
      totalWarnings: 0
    },
    categories: {
      backend: { errors: [], warnings: [], files: [] },
      frontend: { errors: [], warnings: [], files: [] },
      infrastructure: { errors: [], warnings: [], files: [] },
      tests: { errors: [], warnings: [], files: [] },
      configuration: { errors: [], warnings: [], files: [] }
    }
  };
  
  // 1. Analyze Backend TypeScript/JavaScript errors
  console.log('📊 Analyzing Backend errors...');
  analyzeBackendErrors(analysisResults);
  
  // 2. Analyze Frontend errors
  console.log('📊 Analyzing Frontend errors...');
  analyzeFrontendErrors(analysisResults);
  
  // 3. Analyze Infrastructure/Configuration errors
  console.log('📊 Analyzing Infrastructure errors...');
  analyzeInfrastructureErrors(analysisResults);
  
  // 4. Analyze Test errors
  console.log('📊 Analyzing Test errors...');
  analyzeTestErrors(analysisResults);
  
  // 5. Check for common runtime issues
  console.log('📊 Analyzing common runtime issues...');
  analyzeRuntimeIssues(analysisResults);
  
  // 6. Generate comprehensive report
  generateErrorReport(analysisResults);
  
  console.log('✅ Codebase error analysis completed');
  console.log(`📋 Found ${analysisResults.summary.totalErrors} errors and ${analysisResults.summary.totalWarnings} warnings`);
  
  return analysisResults;
}

function analyzeBackendErrors(results) {
  const backendDir = 'Backend';
  
  if (!fs.existsSync(backendDir)) {
    results.categories.backend.errors.push('Backend directory not found');
    return;
  }
  
  try {
    // Check TypeScript compilation
    try {
      const tsOutput = execSync('cd Backend && npx tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' });
      console.log('✅ Backend TypeScript compilation successful');
    } catch (error) {
      const tsErrors = error.stdout || error.stderr || error.message;
      results.categories.backend.errors.push(`TypeScript Compilation Errors:\n${tsErrors}`);
      console.log('❌ Backend TypeScript compilation errors found');
    }
    
    // Check ESLint issues
    try {
      const eslintOutput = execSync('cd Backend && npx eslint . --ext .ts,.js --format=json', { encoding: 'utf8', stdio: 'pipe' });
      const eslintResults = JSON.parse(eslintOutput);
      eslintResults.forEach(result => {
        result.messages.forEach(msg => {
          if (msg.severity === 2) {
            results.categories.backend.errors.push(`${result.filePath}: ${msg.message} (line ${msg.line})`);
          } else {
            results.categories.backend.warnings.push(`${result.filePath}: ${msg.message} (line ${msg.line})`);
          }
        });
      });
    } catch (error) {
      console.log('⚠️  ESLint analysis failed, skipping...');
    }
    
    // Check package.json dependencies
    const packageJsonPath = path.join(backendDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      checkDependencies(packageJson, results.categories.backend, 'Backend');
    }
    
    // Analyze TypeScript files for common issues
    analyzeTypeScriptFiles(backendDir, results.categories.backend);
    
  } catch (error) {
    results.categories.backend.errors.push(`Backend analysis failed: ${error.message}`);
  }
}

function analyzeFrontendErrors(results) {
  const frontendDir = 'Frontend';
  
  if (!fs.existsSync(frontendDir)) {
    results.categories.frontend.errors.push('Frontend directory not found');
    return;
  }
  
  try {
    // Check for package.json
    const packageJsonPath = path.join(frontendDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      checkDependencies(packageJson, results.categories.frontend, 'Frontend');
      
      // Try to run build if build script exists
      if (packageJson.scripts && packageJson.scripts.build) {
        try {
          const buildOutput = execSync('cd Frontend && npm run build', { encoding: 'utf8', stdio: 'pipe' });
          console.log('✅ Frontend build successful');
        } catch (error) {
          const buildErrors = error.stdout || error.stderr || error.message;
          results.categories.frontend.errors.push(`Build Errors:\n${buildErrors}`);
          console.log('❌ Frontend build errors found');
        }
      }
    }
    
    // Analyze frontend files for common issues
    analyzeFrontendFiles(frontendDir, results.categories.frontend);
    
  } catch (error) {
    results.categories.frontend.errors.push(`Frontend analysis failed: ${error.message}`);
  }
}

function analyzeInfrastructureErrors(results) {
  const infraDirs = ['infrastructure', 'docker', '.github/workflows'];
  
  infraDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      analyzeInfrastructureDirectory(dir, results.categories.infrastructure);
    }
  });
  
  // Check Docker files
  const dockerFiles = ['Dockerfile', 'docker-compose.yml', 'docker-compose.prod.yml'];
  dockerFiles.forEach(file => {
    if (fs.existsSync(file)) {
      analyzeDockerFile(file, results.categories.infrastructure);
    }
  });
  
  // Check environment files
  const envFiles = ['.env.example', '.env.production', '.env.example.clms'];
  envFiles.forEach(file => {
    if (fs.existsSync(file)) {
      analyzeEnvFile(file, results.categories.infrastructure);
    }
  });
}

function analyzeTestErrors(results) {
  const testDirs = ['tests', 'Backend/tests', '__tests__'];
  
  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      analyzeTestDirectory(dir, results.categories.tests);
    }
  });
  
  // Try to run tests if available
  try {
    const testOutput = execSync('npm test 2>&1 || true', { encoding: 'utf8', stdio: 'pipe' });
    if (testOutput.includes('FAIL') || testOutput.includes('Error')) {
      results.categories.tests.errors.push(`Test Failures:\n${testOutput}`);
    }
  } catch (error) {
    console.log('⚠️  Could not run tests, skipping test execution analysis');
  }
}

function analyzeRuntimeIssues(results) {
  // Check for common runtime issues
  const files = getAllFiles('.', ['.js', '.ts', '.json']);
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for common issues
      if (content.includes('console.error') || content.includes('throw new Error')) {
        // Check if errors are properly handled
        if (!content.includes('try') && !content.includes('catch')) {
          results.categories.configuration.warnings.push(`${file}: Potential unhandled errors`);
        }
      }
      
      // Check for hardcoded values
      if (content.includes('localhost') || content.includes('127.0.0.1')) {
        if (!file.includes('test') && !file.includes('example')) {
          results.categories.configuration.warnings.push(`${file}: Hardcoded localhost detected`);
        }
      }
      
      // Check for missing error handling in async functions
      if (content.includes('async') && !content.includes('try') && !content.includes('catch')) {
        results.categories.configuration.warnings.push(`${file}: Async function without error handling`);
      }
      
    } catch (error) {
      // Skip files that can't be read
    }
  });
}

function analyzeTypeScriptFiles(dir, category) {
  const files = getAllFiles(dir, ['.ts']);
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for TypeScript specific issues
      if (content.includes('any') && !content.includes('// @ts-ignore')) {
        category.warnings.push(`${file}: Usage of 'any' type detected`);
      }
      
      if (content.includes('// TODO') || content.includes('// FIXME')) {
        category.warnings.push(`${file}: Contains TODO/FIXME comments`);
      }
      
      // Check for missing imports
      if (content.includes('import') && content.includes("from '")) {
        // This is a simplified check - in real scenario would parse AST
        if (content.includes("from './") && !content.includes('.ts') && !content.includes('.js')) {
          category.warnings.push(`${file}: Import might be missing file extension`);
        }
      }
      
    } catch (error) {
      category.errors.push(`${file}: Error reading file - ${error.message}`);
    }
  });
}

function analyzeFrontendFiles(dir, category) {
  const files = getAllFiles(dir, ['.js', '.jsx', '.ts', '.tsx', '.vue', '.html', '.css']);
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for common frontend issues
      if (content.includes('debugger') || content.includes('console.log')) {
        if (!file.includes('test') && !file.includes('spec')) {
          category.warnings.push(`${file}: Debug statements found in production code`);
        }
      }
      
      if (file.endsWith('.html') && content.includes('<script>')) {
        if (!content.includes('type="module"') && !content.includes('type="text/javascript"')) {
          category.warnings.push(`${file}: Script tag without type attribute`);
        }
      }
      
    } catch (error) {
      category.errors.push(`${file}: Error reading file - ${error.message}`);
    }
  });
}

function analyzeInfrastructureDirectory(dir, category) {
  const files = getAllFiles(dir, ['.yml', '.yaml', '.json', '.sh', '.conf']);
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for common infrastructure issues
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        try {
          // Basic YAML syntax check
          if (content.includes('  ') && content.includes('\t')) {
            category.errors.push(`${file}: Mixed tabs and spaces in YAML`);
          }
        } catch (error) {
          category.errors.push(`${file}: YAML syntax error - ${error.message}`);
        }
      }
      
      if (file.endsWith('.sh')) {
        if (!content.startsWith('#!')) {
          category.warnings.push(`${file}: Shell script missing shebang`);
        }
      }
      
    } catch (error) {
      category.errors.push(`${file}: Error reading file - ${error.message}`);
    }
  });
}

function analyzeDockerFile(file, category) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for Docker best practices
    if (content.includes('FROM') && !content.includes('AS')) {
      category.warnings.push(`${file}: Dockerfile missing multi-stage build pattern`);
    }
    
    if (content.includes('ADD') && !content.includes('COPY')) {
      category.warnings.push(`${file}: Consider using COPY instead of ADD`);
    }
    
    if (content.includes('latest') && content.includes('FROM')) {
      category.warnings.push(`${file}: Using 'latest' tag is not recommended for production`);
    }
    
  } catch (error) {
    category.errors.push(`${file}: Error reading Docker file - ${error.message}`);
  }
}

function analyzeEnvFile(file, category) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for common issues in environment files
    if (content.includes('password') || content.includes('secret') || content.includes('key')) {
      if (!file.includes('example')) {
        category.warnings.push(`${file}: Contains sensitive information`);
      }
    }
    
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('=') && !line.includes('#') && line.trim() !== '') {
        if (!line.includes('"') && line.includes(' ')) {
          category.warnings.push(`${file}:${index + 1}: Value with spaces should be quoted`);
        }
      }
    });
    
  } catch (error) {
    category.errors.push(`${file}: Error reading environment file - ${error.message}`);
  }
}

function analyzeTestDirectory(dir, category) {
  const files = getAllFiles(dir, ['.js', '.ts', '.spec.js', '.test.js', '.spec.ts', '.test.ts']);
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for test-specific issues
      if (content.includes('describe') || content.includes('it') || content.includes('test')) {
        if (!content.includes('expect') && !content.includes('assert')) {
          category.warnings.push(`${file}: Test file without assertions`);
        }
      }
      
      if (content.includes('skip') || content.includes('pending')) {
        category.warnings.push(`${file}: Contains skipped or pending tests`);
      }
      
    } catch (error) {
      category.errors.push(`${file}: Error reading test file - ${error.message}`);
    }
  });
}

function checkDependencies(packageJson, category, component) {
  if (packageJson.dependencies) {
    Object.keys(packageJson.dependencies).forEach(dep => {
      if (dep.includes('beta') || dep.includes('alpha') || dep.includes('rc')) {
        category.warnings.push(`${component}: Using pre-release dependency: ${dep}`);
      }
    });
  }
  
  if (packageJson.devDependencies) {
    Object.keys(packageJson.devDependencies).forEach(dep => {
      if (dep.includes('beta') || dep.includes('alpha') || dep.includes('rc')) {
        category.warnings.push(`${component}: Using pre-release dev dependency: ${dep}`);
      }
    });
  }
}

function getAllFiles(dir, extensions = []) {
  const files = [];
  
  function traverse(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile()) {
        if (extensions.length === 0 || extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function generateErrorReport(results) {
  // Update summary
  Object.values(results.categories).forEach(category => {
    results.summary.totalErrors += category.errors.length;
    results.summary.totalWarnings += category.warnings.length;
    results.summary.errorFiles += category.errors.length > 0 ? 1 : 0;
    results.summary.warningFiles += category.warnings.length > 0 ? 1 : 0;
  });
  
  // Generate report file
  const reportContent = `# CLMS Codebase Error Analysis Report

> **Generated**: ${results.timestamp}  
> **Total Files Analyzed**: ${results.summary.totalFiles}  
> **Total Errors**: ${results.summary.totalErrors}  
> **Total Warnings**: ${results.summary.totalWarnings}

## Executive Summary

- **Files with Errors**: ${results.summary.errorFiles}
- **Files with Warnings**: ${results.summary.warningFiles}
- **Overall Health**: ${results.summary.totalErrors === 0 ? '✅ Excellent' : results.summary.totalErrors < 10 ? '⚠️  Good' : '❌ Needs Attention'}

## Error Breakdown by Category

### Backend (${results.categories.backend.errors.length} errors, ${results.categories.backend.warnings.length} warnings)

${results.categories.backend.errors.length > 0 ? '#### Errors:\n' + results.categories.backend.errors.map(e => `- ${e}`).join('\n') : '✅ No errors found'}

${results.categories.backend.warnings.length > 0 ? '#### Warnings:\n' + results.categories.backend.warnings.map(w => `- ${w}`).join('\n') : '✅ No warnings found'}

### Frontend (${results.categories.frontend.errors.length} errors, ${results.categories.frontend.warnings.length} warnings)

${results.categories.frontend.errors.length > 0 ? '#### Errors:\n' + results.categories.frontend.errors.map(e => `- ${e}`).join('\n') : '✅ No errors found'}

${results.categories.frontend.warnings.length > 0 ? '#### Warnings:\n' + results.categories.frontend.warnings.map(w => `- ${w}`).join('\n') : '✅ No warnings found'}

### Infrastructure (${results.categories.infrastructure.errors.length} errors, ${results.categories.infrastructure.warnings.length} warnings)

${results.categories.infrastructure.errors.length > 0 ? '#### Errors:\n' + results.categories.infrastructure.errors.map(e => `- ${e}`).join('\n') : '✅ No errors found'}

${results.categories.infrastructure.warnings.length > 0 ? '#### Warnings:\n' + results.categories.infrastructure.warnings.map(w => `- ${w}`).join('\n') : '✅ No warnings found'}

### Tests (${results.categories.tests.errors.length} errors, ${results.categories.tests.warnings.length} warnings)

${results.categories.tests.errors.length > 0 ? '#### Errors:\n' + results.categories.tests.errors.map(e => `- ${e}`).join('\n') : '✅ No errors found'}

${results.categories.tests.warnings.length > 0 ? '#### Warnings:\n' + results.categories.tests.warnings.map(w => `- ${w}`).join('\n') : '✅ No warnings found'}

### Configuration (${results.categories.configuration.errors.length} errors, ${results.categories.configuration.warnings.length} warnings)

${results.categories.configuration.errors.length > 0 ? '#### Errors:\n' + results.categories.configuration.errors.map(e => `- ${e}`).join('\n') : '✅ No errors found'}

${results.categories.configuration.warnings.length > 0 ? '#### Warnings:\n' + results.categories.configuration.warnings.map(w => `- ${w}`).join('\n') : '✅ No warnings found'}

## Recommendations

1. **Priority 1 - Critical Errors**: Fix all compilation and build errors first
2. **Priority 2 - Test Failures**: Ensure all tests pass
3. **Priority 3 - Warnings**: Address warnings to improve code quality
4. **Priority 4 - Best Practices**: Implement suggested improvements

## Next Steps

1. Run individual fix scripts for each category
2. Validate fixes with automated testing
3. Update documentation as needed
4. Implement continuous monitoring

---

*This report was generated automatically by the CLMS error analysis tool.*
`;
  
  const reportPath = `docs/reports/codebase-error-analysis-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
  ensureDirectoryExists('docs/reports');
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  
  console.log(`📄 Error analysis report saved to: ${reportPath}`);
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Run the analysis
if (require.main === module) {
  analyzeCodebaseErrors();
}

module.exports = { analyzeCodebaseErrors };