#!/usr/bin/env node

/**
 * Performance Test Runner
 * 
 * This script runs all performance tests and generates a comprehensive report
 * of the results, including comparisons against benchmarks and recommendations.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_RESULTS_DIR = path.join(process.cwd(), 'performance-test-results');
const REPORT_FILE = path.join(TEST_RESULTS_DIR, 'performance-report.html');
const JSON_REPORT_FILE = path.join(TEST_RESULTS_DIR, 'performance-report.json');

// Ensure results directory exists
if (!fs.existsSync(TEST_RESULTS_DIR)) {
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

// Performance test suites
const TEST_SUITES = [
  {
    name: 'Database Performance Tests',
    file: 'Backend/src/tests/performance/database-performance.test.ts',
    category: 'database'
  },
  {
    name: 'Import Performance Tests',
    file: 'Backend/src/tests/performance/import-performance.test.ts',
    category: 'import'
  },
  {
    name: 'API Performance Tests',
    file: 'Backend/src/tests/performance/api-performance.test.ts',
    category: 'api'
  },
  {
    name: 'Cache Performance Tests',
    file: 'Backend/src/tests/performance/cache-performance.test.ts',
    category: 'cache'
  },
  {
    name: 'Memory Performance Tests',
    file: 'Backend/src/tests/performance/memory-performance.test.ts',
    category: 'memory'
  },
  {
    name: 'Performance Benchmarks',
    file: 'Backend/src/tests/performance/performance-benchmarks.test.ts',
    category: 'benchmarks'
  }
];

// Performance benchmarks
const BENCHMARKS = {
  database: {
    createStudent: { target: 50, warning: 75, critical: 100 },
    readStudent: { target: 30, warning: 40, critical: 50 },
    updateStudent: { target: 40, warning: 60, critical: 80 },
    deleteStudent: { target: 30, warning: 40, critical: 50 },
    batchCreate: { target: 10, warning: 15, critical: 20 },
    complexQuery: { target: 200, warning: 300, critical: 500 },
    transaction: { target: 30, warning: 40, critical: 50 }
  },
  api: {
    studentList: { target: 100, warning: 150, critical: 200 },
    bookList: { target: 150, warning: 200, critical: 300 },
    equipmentList: { target: 100, warning: 150, critical: 200 },
    searchQuery: { target: 200, warning: 300, critical: 400 },
    analytics: { target: 1000, warning: 1500, critical: 2000 },
    authentication: { target: 300, warning: 400, critical: 500 }
  },
  import: {
    smallDataset: { target: 2000, warning: 3000, critical: 5000 },
    mediumDataset: { target: 10000, warning: 15000, critical: 20000 },
    largeDataset: { target: 30000, warning: 45000, critical: 60000 },
    typeInference: { target: 5000, warning: 7500, critical: 10000 },
    dataTransform: { target: 10000, warning: 15000, critical: 20000 }
  },
  cache: {
    setOperation: { target: 10, warning: 15, critical: 20 },
    getOperation: { target: 5, warning: 8, critical: 10 },
    deleteOperation: { target: 5, warning: 8, critical: 10 },
    batchOperation: { target: 2, warning: 3, critical: 5 },
    invalidation: { target: 100, warning: 150, critical: 200 },
    concurrentOps: { target: 20, warning: 30, critical: 50 }
  },
  memory: {
    maxMemoryIncrease: { target: 100, warning: 150, critical: 200 },
    maxMemoryPerRecord: { target: 50, warning: 75, critical: 100 },
    maxMemoryGrowthPerIteration: { target: 5, warning: 10, critical: 20 },
    maxMemoryRetainedAfterCleanup: { target: 10, warning: 20, critical: 50 }
  }
};

/**
 * Run a test suite and capture results
 */
function runTestSuite(suite) {
  console.log(`\n🧪 Running ${suite.name}...`);
  
  try {
    const startTime = Date.now();
    const output = execSync(`npx vitest run ${suite.file} --reporter=json`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Parse test results
    const testResults = JSON.parse(output);
    
    return {
      suite: suite.name,
      category: suite.category,
      file: suite.file,
      duration,
      passed: testResults.numPassedTests,
      failed: testResults.numFailedTests,
      total: testResults.numTotalTests,
      success: testResults.numFailedTests === 0,
      results: testResults.testResults
    };
  } catch (error) {
    console.error(`❌ Failed to run ${suite.name}:`, error.message);
    
    return {
      suite: suite.name,
      category: suite.category,
      file: suite.file,
      duration: 0,
      passed: 0,
      failed: 1,
      total: 1,
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract performance metrics from test results
 */
function extractMetrics(testResults) {
  const metrics = {};
  
  testResults.forEach(result => {
    if (result.status === 'passed' && result.title) {
      // Try to extract metrics from test title and output
      const title = result.title;
      const output = result.stdout || '';
      
      // Look for performance metrics in the output
      const durationMatch = output.match(/(\d+)ms/);
      const rpsMatch = output.match(/([\d.]+)\s+req\/sec/);
      const memoryMatch = output.match(/([\d.]+)\s+MB/);
      
      if (durationMatch) {
        metrics[title] = {
          duration: parseInt(durationMatch[1]),
          rps: rpsMatch ? parseFloat(rpsMatch[1]) : null,
          memory: memoryMatch ? parseFloat(memoryMatch[1]) : null
        };
      }
    }
  });
  
  return metrics;
}

/**
 * Compare metrics against benchmarks
 */
function compareWithBenchmarks(metrics, category) {
  const benchmarks = BENCHMARKS[category] || {};
  const comparison = {};
  
  Object.entries(metrics).forEach(([metric, values]) => {
    const benchmark = benchmarks[metric];
    
    if (benchmark) {
      const { duration } = values;
      let status = 'pass';
      
      if (duration > benchmark.critical) {
        status = 'critical';
      } else if (duration > benchmark.warning) {
        status = 'warning';
      }
      
      comparison[metric] = {
        value: duration,
        benchmark,
        status,
        ratio: duration / benchmark.target
      };
    } else {
      comparison[metric] = {
        value: values.duration,
        status: 'unknown'
      };
    }
  });
  
  return comparison;
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(testResults, comparisons) {
  const recommendations = [];
  
  // Analyze test results
  testResults.forEach(result => {
    if (!result.success) {
      recommendations.push({
        category: result.category,
        priority: 'high',
        title: `Fix failing tests in ${result.suite}`,
        description: `${result.failed} out of ${result.total} tests failed. Review the test output and fix the issues.`
      });
    }
  });
  
  // Analyze performance comparisons
  Object.entries(comparisons).forEach(([category, metrics]) => {
    Object.entries(metrics).forEach(([metric, comparison]) => {
      if (comparison.status === 'critical') {
        recommendations.push({
          category,
          priority: 'critical',
          title: `Critical performance issue: ${metric}`,
          description: `The ${metric} operation took ${comparison.value}ms, which exceeds the critical threshold of ${comparison.benchmark.critical}ms. This requires immediate attention.`
        });
      } else if (comparison.status === 'warning') {
        recommendations.push({
          category,
          priority: 'medium',
          title: `Performance warning: ${metric}`,
          description: `The ${metric} operation took ${comparison.value}ms, which exceeds the warning threshold of ${comparison.benchmark.warning}ms. Consider optimizing this operation.`
        });
      }
    });
  });
  
  // Add general recommendations
  recommendations.push({
    category: 'general',
    priority: 'low',
    title: 'Regular performance testing',
    description: 'Set up regular performance testing as part of your CI/CD pipeline to catch performance regressions early.'
  });
  
  recommendations.push({
    category: 'general',
    priority: 'low',
    title: 'Monitor production performance',
    description: 'Implement performance monitoring in production to track real-world performance metrics and identify issues before they impact users.'
  });
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Generate HTML report
 */
function generateHtmlReport(testResults, metrics, comparisons, recommendations) {
  const timestamp = new Date().toISOString();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CLMS Performance Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    
    .container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      padding: 30px;
    }
    
    h1, h2, h3 {
      color: #2c3e50;
    }
    
    h1 {
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    
    .summary-card {
      background-color: #f8f9fa;
      border-radius: 6px;
      padding: 20px;
      text-align: center;
    }
    
    .summary-card h3 {
      margin-top: 0;
      color: #3498db;
    }
    
    .summary-card .value {
      font-size: 2em;
      font-weight: bold;
      margin: 10px 0;
    }
    
    .status-pass {
      color: #27ae60;
    }
    
    .status-fail {
      color: #e74c3c;
    }
    
    .status-warning {
      color: #f39c12;
    }
    
    .status-critical {
      color: #c0392b;
    }
    
    .test-results {
      margin: 30px 0;
    }
    
    .test-suite {
      margin-bottom: 20px;
      border: 1px solid #ddd;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .test-suite-header {
      background-color: #f8f9fa;
      padding: 15px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
    }
    
    .test-suite-content {
      padding: 15px;
    }
    
    .metrics-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .metrics-table th, .metrics-table td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    
    .metrics-table th {
      background-color: #f8f9fa;
      font-weight: bold;
    }
    
    .recommendations {
      margin: 30px 0;
    }
    
    .recommendation {
      border-left: 4px solid #ddd;
      padding: 15px;
      margin-bottom: 15px;
      background-color: #f8f9fa;
    }
    
    .recommendation.critical {
      border-left-color: #e74c3c;
    }
    
    .recommendation.high {
      border-left-color: #f39c12;
    }
    
    .recommendation.medium {
      border-left-color: #3498db;
    }
    
    .recommendation.low {
      border-left-color: #95a5a6;
    }
    
    .recommendation h4 {
      margin-top: 0;
    }
    
    .timestamp {
      color: #7f8c8d;
      font-size: 0.9em;
      text-align: center;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>CLMS Performance Test Report</h1>
    
    <div class="timestamp">
      Generated on ${new Date(timestamp).toLocaleString()}
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Test Suites</h3>
        <div class="value">${testResults.length}</div>
        <div>${testResults.filter(r => r.success).length} passed</div>
      </div>
      
      <div class="summary-card">
        <h3>Total Tests</h3>
        <div class="value">${testResults.reduce((sum, r) => sum + r.total, 0)}</div>
        <div>${testResults.reduce((sum, r) => sum + r.passed, 0)} passed</div>
      </div>
      
      <div class="summary-card">
        <h3>Performance Issues</h3>
        <div class="value status-${recommendations.filter(r => r.priority === 'critical').length > 0 ? 'critical' : recommendations.filter(r => r.priority === 'high').length > 0 ? 'fail' : 'pass'}">
          ${recommendations.filter(r => r.priority === 'critical' || r.priority === 'high').length}
        </div>
        <div>critical/high priority</div>
      </div>
      
      <div class="summary-card">
        <h3>Total Duration</h3>
        <div class="value">${(testResults.reduce((sum, r) => sum + r.duration, 0) / 1000).toFixed(2)}s</div>
        <div>across all suites</div>
      </div>
    </div>
    
    <div class="test-results">
      <h2>Test Results</h2>
      
      ${testResults.map(result => `
        <div class="test-suite">
          <div class="test-suite-header">
            <span>${result.suite}</span>
            <span class="status-${result.success ? 'pass' : 'fail'}">
              ${result.success ? 'PASSED' : 'FAILED'}
            </span>
          </div>
          <div class="test-suite-content">
            <p><strong>Category:</strong> ${result.category}</p>
            <p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)}s</p>
            <p><strong>Tests:</strong> ${result.passed}/${result.total} passed</p>
            
            ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
            
            ${metrics[result.category] ? `
              <h4>Performance Metrics</h4>
              <table class="metrics-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(metrics[result.category]).map(([metric, values]) => `
                    <tr>
                      <td>${metric}</td>
                      <td>${values.duration}ms</td>
                      <td class="status-${comparisons[result.category][metric]?.status || 'unknown'}">
                        ${comparisons[result.category][metric]?.status || 'unknown'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="recommendations">
      <h2>Recommendations</h2>
      
      ${recommendations.map(rec => `
        <div class="recommendation ${rec.priority}">
          <h4>${rec.title}</h4>
          <p><strong>Priority:</strong> ${rec.priority}</p>
          <p><strong>Category:</strong> ${rec.category}</p>
          <p>${rec.description}</p>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Main execution function
 */
function main() {
  console.log('🚀 Starting CLMS Performance Test Runner...\n');
  
  const overallStartTime = Date.now();
  const testResults = [];
  const allMetrics = {};
  const allComparisons = {};
  
  // Run all test suites
  TEST_SUITES.forEach(suite => {
    const result = runTestSuite(suite);
    testResults.push(result);
    
    if (result.results) {
      const metrics = extractMetrics(result.results);
      allMetrics[result.category] = metrics;
      allComparisons[result.category] = compareWithBenchmarks(metrics, result.category);
    }
  });
  
  const overallDuration = Date.now() - overallStartTime;
  
  // Generate recommendations
  const recommendations = generateRecommendations(testResults, allComparisons);
  
  // Create JSON report
  const jsonReport = {
    timestamp: new Date().toISOString(),
    duration: overallDuration,
    testResults,
    metrics: allMetrics,
    comparisons: allComparisons,
    recommendations,
    benchmarks: BENCHMARKS
  };
  
  fs.writeFileSync(JSON_REPORT_FILE, JSON.stringify(jsonReport, null, 2));
  
  // Generate HTML report
  const htmlReport = generateHtmlReport(testResults, allMetrics, allComparisons, recommendations);
  fs.writeFileSync(REPORT_FILE, htmlReport);
  
  // Print summary
  console.log('\n📊 Performance Test Summary:');
  console.log(`   Duration: ${(overallDuration / 1000).toFixed(2)}s`);
  console.log(`   Test Suites: ${testResults.length}`);
  console.log(`   Passed: ${testResults.filter(r => r.success).length}`);
  console.log(`   Failed: ${testResults.filter(r => !r.success).length}`);
  console.log(`   Critical Issues: ${recommendations.filter(r => r.priority === 'critical').length}`);
  console.log(`   High Priority Issues: ${recommendations.filter(r => r.priority === 'high').length}`);
  console.log(`\n📄 Reports generated:`);
  console.log(`   HTML: ${REPORT_FILE}`);
  console.log(`   JSON: ${JSON_REPORT_FILE}`);
  
  // Exit with appropriate code
  const hasFailures = testResults.some(r => !r.success);
  const hasCriticalIssues = recommendations.some(r => r.priority === 'critical');
  
  if (hasFailures || hasCriticalIssues) {
    console.log('\n❌ Performance tests completed with issues.');
    process.exit(1);
  } else {
    console.log('\n✅ All performance tests passed successfully!');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  runTestSuite,
  extractMetrics,
  compareWithBenchmarks,
  generateRecommendations,
  generateHtmlReport
};