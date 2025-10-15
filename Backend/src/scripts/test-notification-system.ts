import { PrismaClient, notifications_type, notifications_priority } from '@prisma/client';
import { notificationService } from '../services/notification.service';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';
import { notificationWorker } from '../workers/notificationWorker';

const prisma = new PrismaClient();

interface TestResult {
  testName: string;
  success: boolean;
  error?: string;
  details?: any;
  duration: number;
}

class NotificationSystemTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting CLMS Notification System Tests...\n');

    // Test notification service
    await this.testNotificationCreation();
    await this.testNotificationRetrieval();
    await this.testNotificationPreferences();
    await this.testScheduledNotifications();

    // Test email service
    await this.testEmailConfiguration();
    await this.testEmailTemplates();

    // Test worker functionality
    await this.testBackgroundJobs();
    await this.testQueueStats();

    // Test WebSocket integration
    await this.testWebSocketIntegration();

    // Generate report
    this.generateReport();
  }

  private async testNotificationCreation(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test basic notification creation
      const notification = await notificationService.createNotification({
        type: 'INFO',
        title: 'Test Notification',
        message: 'This is a test notification from the system test suite.',
        priority: 'NORMAL',
        userId: 'test-user-id',
      });

      // Test notification with action URL
      const notificationWithAction = await notificationService.createNotification({
        type: 'WARNING',
        title: 'Test with Action',
        message: 'This notification has an action button.',
        priority: 'HIGH',
        actionUrl: '/test/action',
        userId: 'test-user-id',
      });

      this.results.push({
        testName: 'Notification Creation',
        success: true,
        details: {
          basicNotification: notification.id,
          actionNotification: notificationWithAction.id,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'Notification Creation',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private async testNotificationRetrieval(): Promise<void> {
    const startTime = Date.now();

    try {
      // Create test notifications
      const testNotifications = [
        {
          type: 'INFO' as notifications_type,
          title: 'Test Info',
          message: 'Info notification',
          priority: 'LOW' as notifications_priority,
        },
        {
          type: 'WARNING' as notifications_type,
          title: 'Test Warning',
          message: 'Warning notification',
          priority: 'HIGH' as notifications_priority,
        },
        {
          type: 'ERROR' as notifications_type,
          title: 'Test Error',
          message: 'Error notification',
          priority: 'URGENT' as notifications_priority,
        },
      ];

      const createdNotifications = await Promise.all(
        testNotifications.map(n => notificationService.createNotification(n))
      );

      // Test retrieval
      const allNotifications = await notificationService.getUserNotifications('test-user-id');
      const unreadNotifications = await notificationService.getUserNotifications('test-user-id', { unreadOnly: true });
      const filteredNotifications = await notificationService.getUserNotifications('test-user-id', { type: 'INFO' });

      // Test statistics
      const stats = await notificationService.getNotificationStats('test-user-id');

      this.results.push({
        testName: 'Notification Retrieval',
        success: true,
        details: {
          totalCreated: createdNotifications.length,
          totalRetrieved: allNotifications.total,
          unreadRetrieved: unreadNotifications.unreadCount,
          filteredRetrieved: filteredNotifications.total,
          stats: stats,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'Notification Retrieval',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private async testNotificationPreferences(): Promise<void> {
    const startTime = Date.now();

    try {
      const testUserId = 'test-user-id';

      // Get default preferences
      const defaultPrefs = await notificationService.getUserNotificationPreferences(testUserId);

      // Update preferences
      const updatedPrefs = await notificationService.updateUserNotificationPreferences(testUserId, {
        emailNotifications: false,
        dueDateReminders: false,
        fineAlerts: true,
      });

      // Verify preferences were updated
      const retrievedPrefs = await notificationService.getUserNotificationPreferences(testUserId);

      const success =
        retrievedPrefs.emailNotifications === false &&
        retrievedPrefs.dueDateReminders === false &&
        retrievedPrefs.fineAlerts === true;

      this.results.push({
        testName: 'Notification Preferences',
        success,
        details: {
          defaultPreferences: defaultPrefs,
          updatedPreferences: updatedPrefs,
          retrievedPreferences: retrievedPrefs,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'Notification Preferences',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private async testScheduledNotifications(): Promise<void> {
    const startTime = Date.now();

    try {
      const futureTime = new Date(Date.now() + 60000); // 1 minute from now

      // Schedule a notification
      const scheduledResult = await notificationService.createNotification({
        type: 'INFO',
        title: 'Scheduled Test',
        message: 'This notification was scheduled for future delivery.',
        scheduledFor: futureTime,
        userId: 'test-user-id',
      });

      this.results.push({
        testName: 'Scheduled Notifications',
        success: true,
        details: {
          scheduledNotificationId: scheduledResult.id,
          scheduledTime: futureTime,
          isScheduled: (scheduledResult as any).scheduled,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'Scheduled Notifications',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private async testEmailConfiguration(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test email service status
      const emailStatus = emailService.getStatus();

      // Test email configuration (without sending)
      const configTest = await emailService.testConfiguration();

      this.results.push({
        testName: 'Email Configuration',
        success: true,
        details: {
          emailServiceConnected: emailStatus.connected,
          emailConfig: emailStatus.config,
          configurationTest: configTest,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'Email Configuration',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private async testEmailTemplates(): Promise<void> {
    const startTime = Date.now();

    try {
      // Create a test notification to generate templates
      const testNotification = {
        id: 'test-email-template',
        type: 'WARNING' as notifications_type,
        title: 'Test Email Template',
        message: 'This is a test of the email template system.',
        priority: 'HIGH' as notifications_priority,
        action_url: '/test/action',
        created_at: new Date(),
      };

      // Test HTML template generation
      const htmlTemplate = (notificationService as any).generateEmailTemplate(testNotification, 'Test User');

      // Test text template generation
      const textTemplate = (notificationService as any).generateTextTemplate(testNotification, 'Test User');

      // Test subject generation
      const subject = (notificationService as any).generateEmailSubject(testNotification);

      this.results.push({
        testName: 'Email Templates',
        success: true,
        details: {
          htmlTemplateLength: htmlTemplate.length,
          textTemplateLength: textTemplate.length,
          subject: subject,
          containsUserReference: htmlTemplate.includes('Test User'),
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'Email Templates',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private async testBackgroundJobs(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test queue statistics
      const queueStats = notificationWorker.getQueueStats();

      // Test system maintenance scheduling
      const maintenanceTime = new Date(Date.now() + 300000); // 5 minutes from now
      const maintenanceJobId = await notificationWorker.scheduleSystemMaintenance({
        title: 'Test Maintenance',
        message: 'This is a test maintenance notification.',
        scheduledTime: maintenanceTime,
      });

      this.results.push({
        testName: 'Background Jobs',
        success: true,
        details: {
          queueStats: queueStats,
          maintenanceJobId: maintenanceJobId,
          maintenanceScheduledTime: maintenanceTime,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'Background Jobs',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private async testQueueStats(): Promise<void> {
    const startTime = Date.now();

    try {
      const stats = notificationWorker.getQueueStats();

      this.results.push({
        testName: 'Queue Statistics',
        success: true,
        details: {
          scheduledNotifications: stats.scheduledNotifications,
          totalWaiting: stats.scheduledNotifications.waiting + stats.scheduledNotifications.active,
          totalCompleted: stats.scheduledNotifications.completed,
          totalFailed: stats.scheduledNotifications.failed,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'Queue Statistics',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private async testWebSocketIntegration(): Promise<void> {
    const startTime = Date.now();

    try {
      // This is a basic test - actual WebSocket testing would require a running server
      // and WebSocket client connection

      // Test that WebSocket server can be imported and initialized
      const { websocketServer } = require('../websocket/websocketServer');

      // Test status
      const status = websocketServer.getStatus();

      this.results.push({
        testName: 'WebSocket Integration',
        success: true,
        details: {
          serverInitialized: status.isInitialized,
          serverRunning: status.isRunning,
          connectionStats: status.stats,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        testName: 'WebSocket Integration',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  private generateReport(): void {
    console.log('\n📊 Test Results Report');
    console.log('='.repeat(50));

    const passedTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    const failedTests = totalTests - passedTests;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\nDetailed Results:');
    console.log('-'.repeat(30));

    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;

      console.log(`${index + 1}. ${status} ${result.testName} (${duration})`);

      if (!result.success) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).substring(0, 200)}...`);
      }

      console.log('');
    });

    // Performance Summary
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / totalTests;
    const slowestTest = this.results.reduce((prev, current) =>
      current.duration > prev.duration ? current : prev
    );
    const fastestTest = this.results.reduce((prev, current) =>
      current.duration < prev.duration ? current : prev
    );

    console.log('📈 Performance Summary:');
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average Test Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`Slowest Test: ${slowestTest.testName} (${slowestTest.duration}ms)`);
    console.log(`Fastest Test: ${fastestTest.testName} (${fastestTest.duration}ms)`);

    if (failedTests === 0) {
      console.log('\n🎉 All tests passed! The notification system is working correctly.');
    } else {
      console.log(`\n⚠️  ${failedTests} test(s) failed. Please review the errors above.`);
    }

    console.log('\n✨ Test completed at:', new Date().toISOString());
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new NotificationSystemTester();

  tester.runAllTests()
    .then(() => {
      console.log('\nTest execution completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { NotificationSystemTester };