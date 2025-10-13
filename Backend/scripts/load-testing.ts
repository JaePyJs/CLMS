/**
 * CLMS Performance Benchmark and Load Testing Suite
 *
 * This script provides comprehensive load testing capabilities including
 * stress testing, performance benchmarks, and scalability analysis.
 */

import { createHash } from 'crypto';
import autocannon from 'autocannon';
import { performance } from 'perf_hooks';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

interface LoadTestConfig {
  target: string;
  connections: number;
  duration: number;
  pipelining: number;
  requests: Array<{
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
  }>;
}

interface BenchmarkResult {
  testName: string;
  timestamp: number;
  config: LoadTestConfig;
  results: {
    requests: {
      total: number;
      average: number;
      sent: number;
      completed: number;
    };
    latency: {
      average: number;
      min: number;
      max: number;
      p2_5: number;
      p50: number;
      p97_5: number;
      p99: number;
    };
    throughput: {
      average: number;
      min: number;
      max: number;
    };
    errors: number;
    timeouts: number;
    non2xx: number;
  };
  analysis: {
    requestsPerSecond: number;
    averageLatency: number;
    errorRate: number;
    successRate: number;
    performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendations: string[];
  };
}

interface PerformanceMetrics {
  cpu: number[];
  memory: number[];
  responseTime: number[];
  throughput: number[];
  errorRate: number[];
  webSocketLatency: number[];
  webSocketConnections: number[];
}

interface WebSocketTestConfig {
  target: string;
  connections: number;
  duration: number;
  messageRate: number;
  messageTypes: string[];
}

class CLMSLoadTester {
  private results: BenchmarkResult[] = [];
  private metrics: PerformanceMetrics = {
    cpu: [],
    memory: [],
    responseTime: [],
    throughput: [],
    errorRate: [],
    webSocketLatency: [],
    webSocketConnections: [],
  };
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  // Test configurations for different scenarios
  private getTestConfigurations(): LoadTestConfig[] {
    return [
      // Basic health check
      {
        target: this.baseUrl,
        connections: 10,
        duration: 10,
        pipelining: 1,
        requests: [
          {
            method: 'GET',
            path: '/health',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ],
      },

      // API endpoints - low load
      {
        target: this.baseUrl,
        connections: 20,
        duration: 30,
        pipelining: 1,
        requests: [
          {
            method: 'GET',
            path: '/api/students',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/books',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/equipment',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
        ],
      },

      // API endpoints - medium load
      {
        target: this.baseUrl,
        connections: 50,
        duration: 60,
        pipelining: 2,
        requests: [
          {
            method: 'GET',
            path: '/api/students?limit=50',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/books?limit=100',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/activities?limit=100',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
        ],
      },

      // API endpoints - high load
      {
        target: this.baseUrl,
        connections: 100,
        duration: 120,
        pipelining: 3,
        requests: [
          {
            method: 'GET',
            path: '/api/students',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/books',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'POST',
            path: '/api/students/search',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: 'test',
              limit: 10,
            }),
          },
        ],
      },

      // Stress test - maximum load
      {
        target: this.baseUrl,
        connections: 200,
        duration: 180,
        pipelining: 5,
        requests: [
          {
            method: 'GET',
            path: '/api/analytics/dashboard',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/reports/summary',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
        ],
      },

      // Concurrent operations test
      {
        target: this.baseUrl,
        connections: 150,
        duration: 90,
        pipelining: 2,
        requests: [
          {
            method: 'GET',
            path: '/api/students',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/books',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/equipment',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          },
          {
            method: 'POST',
            path: '/api/scan',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              barcode: '123456789',
              type: 'student',
            }),
          },
        ],
      },
    ];
  }

  async runLoadTest(testName: string, config: LoadTestConfig): Promise<BenchmarkResult> {
    console.log(`\n🚀 Starting load test: ${testName}`);
    console.log(`Target: ${config.target}`);
    console.log(`Connections: ${config.connections}`);
    console.log(`Duration: ${config.duration}s`);
    console.log(`Pipelining: ${config.pipelining}`);

    const startTime = performance.now();

    // Start monitoring system metrics
    const metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 1000);

    try {
      const result = await this.runAutocannonTest(config);
      const endTime = performance.now();

      clearInterval(metricsInterval);

      const benchmarkResult: BenchmarkResult = {
        testName,
        timestamp: Date.now(),
        config,
        results: {
          requests: {
            total: result.requests.total,
            average: result.requests.average,
            sent: result.requests.sent,
            completed: result.requests.completed,
          },
          latency: {
            average: result.latency.average,
            min: result.latency.min,
            max: result.latency.max,
            p2_5: result.latency.p2_5,
            p50: result.latency.p50,
            p97_5: result.latency.p97_5,
            p99: result.latency.p99,
          },
          throughput: {
            average: result.throughput.average,
            min: result.throughput.min,
            max: result.throughput.max,
          },
          errors: result.errors,
          timeouts: result.timeouts,
          non2xx: result.non2xx,
        },
        analysis: this.analyzeResults(result),
      };

      this.results.push(benchmarkResult);

      console.log(`\n✅ Load test completed: ${testName}`);
      console.log(`Total requests: ${result.requests.total}`);
      console.log(`Average latency: ${result.latency.average.toFixed(2)}ms`);
      console.log(`Throughput: ${result.throughput.average.toFixed(2)} req/s`);
      console.log(`Errors: ${result.errors}`);
      console.log(`Performance grade: ${benchmarkResult.analysis.performanceGrade}`);

      return benchmarkResult;
    } catch (error) {
      clearInterval(metricsInterval);
      console.error(`❌ Load test failed: ${testName}`, error);
      throw error;
    }
  }

  private async runAutocannonTest(config: LoadTestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      const instance = autocannon({
        url: config.target,
        connections: config.connections,
        duration: config.duration,
        pipelining: config.pipelining,
        requests: config.requests.map(req => ({
          ...req,
          path: req.path,
        })),
      });

      autocannon.track(instance, { renderProgressBar: true });

      instance.on('done', (result) => {
        resolve(result);
      });

      instance.on('error', (error) => {
        reject(error);
      });

      // Start the test
      instance.start();
    });
  }

  private analyzeResults(result: any): BenchmarkResult['analysis'] {
    const requestsPerSecond = result.throughput.average;
    const averageLatency = result.latency.average;
    const totalRequests = result.requests.total;
    const errors = result.errors;
    const errorRate = totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
    const successRate = 100 - errorRate;

    // Performance grading
    let performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    let recommendations: string[] = [];

    if (requestsPerSecond >= 1000 && averageLatency <= 100 && errorRate <= 0.1) {
      performanceGrade = 'A';
      recommendations.push('Excellent performance! System is highly optimized.');
    } else if (requestsPerSecond >= 500 && averageLatency <= 200 && errorRate <= 0.5) {
      performanceGrade = 'B';
      recommendations.push('Good performance with room for optimization.');
      if (averageLatency > 150) {
        recommendations.push('Consider optimizing database queries and caching.');
      }
    } else if (requestsPerSecond >= 200 && averageLatency <= 500 && errorRate <= 1) {
      performanceGrade = 'C';
      recommendations.push('Moderate performance. Some optimizations needed.');
      recommendations.push('Review slow queries and consider implementing connection pooling.');
      if (errorRate > 0.5) {
        recommendations.push('Investigate and fix error sources.');
      }
    } else if (requestsPerSecond >= 100 && averageLatency <= 1000 && errorRate <= 2) {
      performanceGrade = 'D';
      recommendations.push('Poor performance. Significant optimizations required.');
      recommendations.push('Implement comprehensive caching strategy.');
      recommendations.push('Optimize database connections and queries.');
      recommendations.push('Consider scaling horizontally.');
    } else {
      performanceGrade = 'F';
      recommendations.push('Critical performance issues detected.');
      recommendations.push('Immediate optimization required.');
      recommendations.push('Review system architecture and infrastructure.');
      recommendations.push('Implement monitoring and alerting.');
    }

    // Specific recommendations based on metrics
    if (result.latency.p99 > 5000) {
      recommendations.push('High P99 latency detected. Check for outliers and optimize slow requests.');
    }

    if (result.errors > totalRequests * 0.05) {
      recommendations.push('High error rate detected. Investigate error sources and improve error handling.');
    }

    if (result.throughput.max / result.throughput.min > 3) {
      recommendations.push('High throughput variance detected. Check for resource contention.');
    }

    return {
      requestsPerSecond,
      averageLatency,
      errorRate,
      successRate,
      performanceGrade,
      recommendations,
    };
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.memory.push(memUsage.heapUsed / 1024 / 1024); // MB
    this.metrics.cpu.push(cpuUsage.user / 1000000); // Convert to percentage

    // Keep only last 100 data points
    if (this.metrics.memory.length > 100) {
      this.metrics.memory = this.metrics.memory.slice(-100);
    }
    if (this.metrics.cpu.length > 100) {
      this.metrics.cpu = this.metrics.cpu.slice(-100);
    }
  }

  // WebSocket load testing methods
  private getWebSocketTestConfigurations(): WebSocketTestConfig[] {
    return [
      // Basic WebSocket connection test
      {
        target: this.baseUrl.replace('http://', 'ws://').replace('3001', '3002') + '/ws',
        connections: 10,
        duration: 30,
        messageRate: 1, // messages per second
        messageTypes: ['ping', 'subscribe']
      },
      // Medium WebSocket load test
      {
        target: this.baseUrl.replace('http://', 'ws://').replace('3001', '3002') + '/ws',
        connections: 50,
        duration: 60,
        messageRate: 5,
        messageTypes: ['ping', 'subscribe', 'get_activity', 'get_equipment_status']
      },
      // High WebSocket load test
      {
        target: this.baseUrl.replace('http://', 'ws://').replace('3001', '3002') + '/ws',
        connections: 100,
        duration: 120,
        messageRate: 10,
        messageTypes: ['ping', 'subscribe', 'get_activity', 'get_equipment_status', 'log_activity']
      },
      // WebSocket stress test
      {
        target: this.baseUrl.replace('http://', 'ws://').replace('3001', '3002') + '/ws',
        connections: 200,
        duration: 180,
        messageRate: 20,
        messageTypes: ['ping', 'subscribe', 'get_activity', 'get_equipment_status', 'log_activity', 'get_analytics']
      }
    ];
  }

  async runWebSocketLoadTest(testName: string, config: WebSocketTestConfig): Promise<any> {
    console.log(`\n🔌 Starting WebSocket load test: ${testName}`);
    console.log(`Target: ${config.target}`);
    console.log(`Connections: ${config.connections}`);
    console.log(`Duration: ${config.duration}s`);
    console.log(`Message Rate: ${config.messageRate} msg/s`);

    const startTime = performance.now();
    const results = {
      connections: {
        successful: 0,
        failed: 0,
        total: config.connections
      },
      messages: {
        sent: 0,
        received: 0,
        errors: 0
      },
      latency: {
        samples: [] as number[],
        average: 0,
        min: Infinity,
        max: 0,
        p95: 0,
        p99: 0
      },
      throughput: {
        messagesPerSecond: 0,
        peakMessagesPerSecond: 0
      },
      errors: [] as string[],
      duration: 0
    };

    const connections: WebSocket[] = [];
    const messageTimestamps = new Map<number, number>();
    let messageId = 0;

    // Create WebSocket connections
    for (let i = 0; i < config.connections; i++) {
      try {
        const token = jwt.sign(
          {
            id: `loadtest-ws-${i}`,
            username: `loadtest-ws-${i}`,
            role: 'STAFF'
          },
          'load-test-jwt-secret',
          { expiresIn: '1h' }
        );

        const ws = new WebSocket(config.target, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        connections.push(ws);

        ws.on('open', () => {
          results.connections.successful++;

          // Subscribe to initial topics
          ws.send(JSON.stringify({
            type: 'subscribe',
            data: { id: crypto.randomUUID(), updated_at: new Date(),  subscriptions: ['activities', 'equipment'] }
          }));
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            results.messages.received++;

            // Calculate latency for ping messages
            if (message.type === 'pong' && message.data.timestamp) {
              const latency = Date.now() - new Date(message.data.timestamp).getTime();
              results.latency.samples.push(latency);
              messageTimestamps.delete(message.data.messageId);
            }
          } catch (error) {
            results.messages.errors++;
            results.errors.push(`Message parsing error: ${error.message}`);
          }
        });

        ws.on('error', (error) => {
          results.connections.failed++;
          results.errors.push(`WebSocket error: ${error.message}`);
        });

        ws.on('close', () => {
          // Connection closed
        });

      } catch (error) {
        results.connections.failed++;
        results.errors.push(`Connection error: ${error.message}`);
      }
    }

    // Wait for connections to establish
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Start sending messages
    const messageInterval = setInterval(() => {
      connections.forEach((ws, index) => {
        if (ws.readyState === WebSocket.OPEN) {
          const messageType = config.messageTypes[Math.floor(Math.random() * config.messageTypes.length)];
          const currentMessageId = messageId++;

          let message: any;

          switch (messageType) {
            case 'ping':
              message = {
                type: 'ping',
                data: { id: crypto.randomUUID(), updated_at: new Date(), 
                  timestamp: new Date().toISOString(),
                  messageId: currentMessageId
                }
              };
              messageTimestamps.set(currentMessageId, Date.now());
              break;

            case 'subscribe':
              message = {
                type: 'subscribe',
                data: { id: crypto.randomUUID(), updated_at: new Date(), 
                  subscriptions: ['activities', 'equipment', 'analytics']
                }
              };
              break;

            case 'get_activity':
              message = {
                type: 'get_activity',
                data: { id: crypto.randomUUID(), updated_at: new Date(),  limit: 10 }
              };
              break;

            case 'get_equipment_status':
              message = {
                type: 'get_equipment_status',
                data: { id: crypto.randomUUID(), updated_at: new Date(), }
              };
              break;

            case 'log_activity':
              message = {
                type: 'log_activity',
                data: { id: crypto.randomUUID(), updated_at: new Date(), 
                  student_id: `WS-LOAD-${index}`,
                  activity_type: 'COMPUTER_USE',
                  notes: 'Load test activity'
                }
              };
              break;

            case 'get_analytics':
              message = {
                type: 'get_activity_stats',
                data: { id: crypto.randomUUID(), updated_at: new Date(),  timeframe: 'day' }
              };
              break;

            default:
              message = {
                type: 'ping',
                data: { id: crypto.randomUUID(), updated_at: new Date(),  timestamp: new Date().toISOString() }
              };
          }

          try {
            ws.send(JSON.stringify(message));
            results.messages.sent++;
          } catch (error) {
            results.messages.errors++;
            results.errors.push(`Send error: ${error.message}`);
          }
        }
      });
    }, 1000 / config.messageRate);

    // Monitor throughput
    const throughputInterval = setInterval(() => {
      const currentThroughput = results.messages.received / ((performance.now() - startTime) / 1000);
      if (currentThroughput > results.throughput.peakMessagesPerSecond) {
        results.throughput.peakMessagesPerSecond = currentThroughput;
      }
    }, 1000);

    // Run for specified duration
    await new Promise(resolve => setTimeout(resolve, config.duration * 1000));

    clearInterval(messageInterval);
    clearInterval(throughputInterval);

    // Close connections
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    // Calculate final metrics
    results.duration = performance.now() - startTime;
    results.throughput.messagesPerSecond = results.messages.received / (results.duration / 1000);

    // Calculate latency statistics
    if (results.latency.samples.length > 0) {
      results.latency.average = results.latency.samples.reduce((sum, lat) => sum + lat, 0) / results.latency.samples.length;
      results.latency.min = Math.min(...results.latency.samples);
      results.latency.max = Math.max(...results.latency.samples);

      const sortedSamples = results.latency.samples.sort((a, b) => a - b);
      results.latency.p95 = sortedSamples[Math.floor(sortedSamples.length * 0.95)];
      results.latency.p99 = sortedSamples[Math.floor(sortedSamples.length * 0.99)];
    }

    // Update metrics
    this.metrics.webSocketConnections.push(results.connections.successful);
    this.metrics.webSocketLatency.push(...results.latency.samples);

    // Keep only last 100 data points
    if (this.metrics.webSocketConnections.length > 100) {
      this.metrics.webSocketConnections = this.metrics.webSocketConnections.slice(-100);
    }
    if (this.metrics.webSocketLatency.length > 100) {
      this.metrics.webSocketLatency = this.metrics.webSocketLatency.slice(-100);
    }

    console.log(`\n✅ WebSocket load test completed: ${testName}`);
    console.log(`Successful connections: ${results.connections.successful}/${results.connections.total}`);
    console.log(`Messages sent: ${results.messages.sent}`);
    console.log(`Messages received: ${results.messages.received}`);
    console.log(`Average latency: ${results.latency.average.toFixed(2)}ms`);
    console.log(`Throughput: ${results.throughput.messagesPerSecond.toFixed(2)} msg/s`);

    return results;
  }

  async runAllTests(): Promise<void> {
    console.log('🔥 Starting CLMS Performance Benchmark Suite');
    console.log('='.repeat(50));

    const apiConfigurations = this.getTestConfigurations();
    const wsConfigurations = this.getWebSocketTestConfigurations();
    const allConfigurations = [
      ...apiConfigurations.map((config, index) => ({ config, type: 'api', index })),
      ...wsConfigurations.map((config, index) => ({ config, type: 'websocket', index }))
    ];

    for (const [testIndex, { config, type, index }] of allConfigurations.entries()) {
      let testName: string;

      if (type === 'api') {
        testName = `API Test ${index + 1}: ${this.getTestDescription(config)}`;

        try {
          await this.runLoadTest(testName, config);
        } catch (error) {
          console.error(`❌ API Test failed: ${testName}`, error);
        }
      } else {
        testName = `WebSocket Test ${index + 1}: ${this.getWebSocketTestDescription(config)}`;

        try {
          await this.runWebSocketLoadTest(testName, config);
        } catch (error) {
          console.error(`❌ WebSocket Test failed: ${testName}`, error);
        }
      }

      // Wait between tests to allow system to recover
      if (testIndex < allConfigurations.length - 1) {
        console.log('\n⏳ Waiting 30 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    await this.generateReport();
  }

  private getWebSocketTestDescription(config: WebSocketTestConfig): string {
    if (config.connections <= 10) {
      return 'Basic WebSocket Test';
    } else if (config.connections <= 50) {
      return 'Light WebSocket Load Test';
    } else if (config.connections <= 100) {
      return 'Medium WebSocket Load Test';
    } else if (config.connections <= 200) {
      return 'High WebSocket Load Test';
    } else {
      return 'WebSocket Stress Test';
    }
  }

  private getTestDescription(config: LoadTestConfig): string {
    if (config.connections <= 10) {
      return 'Health Check';
    } else if (config.connections <= 20) {
      return 'Light Load Test';
    } else if (config.connections <= 50) {
      return 'Medium Load Test';
    } else if (config.connections <= 100) {
      return 'High Load Test';
    } else if (config.connections <= 150) {
      return 'Very High Load Test';
    } else {
      return 'Stress Test';
    }
  }

  async generateReport(): Promise<void> {
    console.log('\n📊 Generating Performance Report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      tests: this.results,
      metrics: this.metrics,
      recommendations: this.generateOverallRecommendations(),
    };

    // Ensure reports directory exists
    try {
      await mkdir(join(process.cwd(), 'reports'), { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save detailed report
    const reportPath = join(process.cwd(), 'reports', `performance-report-${Date.now()}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    // Save summary report
    const summaryPath = join(process.cwd(), 'reports', 'performance-summary.json');
    await writeFile(summaryPath, JSON.stringify(report.summary, null, 2));

    console.log(`\n📁 Reports saved:`);
    console.log(`  Detailed: ${reportPath}`);
    console.log(`  Summary: ${summaryPath}`);

    this.printSummary(report.summary);
  }

  private generateSummary(): any {
    if (this.results.length === 0) {
      return { error: 'No test results available' };
    }

    const totalRequests = this.results.reduce((sum, result) => sum + result.results.requests.total, 0);
    const averageLatency = this.results.reduce((sum, result) => sum + result.results.latency.average, 0) / this.results.length;
    const averageThroughput = this.results.reduce((sum, result) => sum + result.results.throughput.average, 0) / this.results.length;
    const totalErrors = this.results.reduce((sum, result) => sum + result.results.errors, 0);
    const overallErrorRate = (totalErrors / totalRequests) * 100;

    const performanceGrades = this.results.map(result => result.analysis.performanceGrade);
    const gradeCounts = performanceGrades.reduce((acc, grade) => {
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const peakThroughput = Math.max(...this.results.map(result => result.results.throughput.max));
    const lowestLatency = Math.min(...this.results.map(result => result.results.latency.min));
    const highestLatency = Math.max(...this.results.map(result => result.results.latency.max));

    return {
      testSuite: {
        totalTests: this.results.length,
        totalRequests,
        totalErrors,
        overallErrorRate,
        averageLatency: Math.round(averageLatency),
        averageThroughput: Math.round(averageThroughput),
        peakThroughput: Math.round(peakThroughput),
        lowestLatency: Math.round(lowestLatency),
        highestLatency: Math.round(highestLatency),
      },
      performanceDistribution: gradeCounts,
      bestPerformance: this.getBestPerformance(),
      worstPerformance: this.getWorstPerformance(),
      systemMetrics: {
        averageMemoryUsage: this.metrics.memory.length > 0
          ? this.metrics.memory.reduce((sum, val) => sum + val, 0) / this.metrics.memory.length
          : 0,
        peakMemoryUsage: this.metrics.memory.length > 0 ? Math.max(...this.metrics.memory) : 0,
        averageCpuUsage: this.metrics.cpu.length > 0
          ? this.metrics.cpu.reduce((sum, val) => sum + val, 0) / this.metrics.cpu.length
          : 0,
        peakCpuUsage: this.metrics.cpu.length > 0 ? Math.max(...this.metrics.cpu) : 0,
        averageWebSocketConnections: this.metrics.webSocketConnections.length > 0
          ? this.metrics.webSocketConnections.reduce((sum, val) => sum + val, 0) / this.metrics.webSocketConnections.length
          : 0,
        peakWebSocketConnections: this.metrics.webSocketConnections.length > 0 ? Math.max(...this.metrics.webSocketConnections) : 0,
        averageWebSocketLatency: this.metrics.webSocketLatency.length > 0
          ? this.metrics.webSocketLatency.reduce((sum, val) => sum + val, 0) / this.metrics.webSocketLatency.length
          : 0,
        peakWebSocketLatency: this.metrics.webSocketLatency.length > 0 ? Math.max(...this.metrics.webSocketLatency) : 0,
      },
    };
  }

  private getBestPerformance(): any {
    const bestResult = this.results.reduce((best, current) =>
      current.results.throughput.average > best.results.throughput.average ? current : best
    );

    return {
      testName: bestResult.testName,
      throughput: Math.round(bestResult.results.throughput.average),
      latency: Math.round(bestResult.results.latency.average),
      connections: bestResult.config.connections,
    };
  }

  private getWorstPerformance(): any {
    const worstResult = this.results.reduce((worst, current) =>
      current.analysis.errorRate > worst.analysis.errorRate ? current : worst
    );

    return {
      testName: worstResult.testName,
      errorRate: worstResult.analysis.errorRate,
      throughput: Math.round(worstResult.results.throughput.average),
      latency: Math.round(worstResult.results.latency.average),
      connections: worstResult.config.connections,
    };
  }

  private generateOverallRecommendations(): string[] {
    const recommendations = new Set<string>();

    this.results.forEach(result => {
      result.analysis.recommendations.forEach(rec => recommendations.add(rec));
    });

    // Add overall system recommendations
    const summary = this.generateSummary();

    if (summary.systemMetrics.averageMemoryUsage > 500) {
      recommendations.add('High memory usage detected. Consider optimizing memory usage and implementing memory leaks detection.');
    }

    if (summary.systemMetrics.averageCpuUsage > 80) {
      recommendations.add('High CPU usage detected. Consider optimizing CPU-intensive operations and scaling horizontally.');
    }

    if (summary.testSuite.overallErrorRate > 1) {
      recommendations.add('High overall error rate. Implement better error handling and retry mechanisms.');
    }

    if (summary.testSuite.averageLatency > 1000) {
      recommendations.add('High average latency. Review and optimize database queries, API responses, and network calls.');
    }

    return Array.from(recommendations);
  }

  private printSummary(summary: any): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(50));

    console.log(`\n🔢 Test Statistics:`);
    console.log(`  Total Tests: ${summary.testSuite.totalTests}`);
    console.log(`  Total Requests: ${summary.testSuite.totalRequests.toLocaleString()}`);
    console.log(`  Total Errors: ${summary.testSuite.totalErrors.toLocaleString()}`);
    console.log(`  Overall Error Rate: ${summary.testSuite.overallErrorRate.toFixed(2)}%`);

    console.log(`\n⚡ Performance Metrics:`);
    console.log(`  Average Latency: ${summary.testSuite.averageLatency}ms`);
    console.log(`  Average Throughput: ${summary.testSuite.averageThroughput} req/s`);
    console.log(`  Peak Throughput: ${summary.testSuite.peakThroughput} req/s`);
    console.log(`  Latency Range: ${summary.testSuite.lowestLatency}ms - ${summary.testSuite.highestLatency}ms`);

    console.log(`\n🏆 Performance Distribution:`);
    Object.entries(summary.performanceDistribution).forEach(([grade, count]) => {
      console.log(`  Grade ${grade}: ${count} tests`);
    });

    console.log(`\n💻 System Metrics:`);
    console.log(`  Average Memory Usage: ${summary.systemMetrics.averageMemoryUsage.toFixed(2)} MB`);
    console.log(`  Peak Memory Usage: ${summary.systemMetrics.peakMemoryUsage.toFixed(2)} MB`);
    console.log(`  Average CPU Usage: ${summary.systemMetrics.averageCpuUsage.toFixed(2)}%`);
    console.log(`  Peak CPU Usage: ${summary.systemMetrics.peakCpuUsage.toFixed(2)}%`);

    if (summary.systemMetrics.averageWebSocketConnections > 0) {
      console.log(`\n🔌 WebSocket Metrics:`);
      console.log(`  Average Connections: ${summary.systemMetrics.averageWebSocketConnections.toFixed(0)}`);
      console.log(`  Peak Connections: ${summary.systemMetrics.peakWebSocketConnections.toFixed(0)}`);
      console.log(`  Average Latency: ${summary.systemMetrics.averageWebSocketLatency.toFixed(2)}ms`);
      console.log(`  Peak Latency: ${summary.systemMetrics.peakWebSocketLatency.toFixed(2)}ms`);
    }

    console.log(`\n🎯 Best Performance:`);
    console.log(`  Test: ${summary.bestPerformance.testName}`);
    console.log(`  Throughput: ${summary.bestPerformance.throughput} req/s`);
    console.log(`  Latency: ${summary.bestPerformance.latency}ms`);

    console.log(`\n⚠️  Areas for Improvement:`);
    console.log(`  Test: ${summary.worstPerformance.testName}`);
    console.log(`  Error Rate: ${summary.worstPerformance.errorRate.toFixed(2)}%`);

    console.log('\n' + '='.repeat(50));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'http://localhost:3001';

  console.log('🚀 CLMS Load Testing Suite');
  console.log(`Target: ${baseUrl}`);
  console.log('='.repeat(50));

  const tester = new CLMSLoadTester(baseUrl);

  try {
    await tester.runAllTests();
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { CLMSLoadTester, type LoadTestConfig, type BenchmarkResult };
export default CLMSLoadTester;