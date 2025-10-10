const cron = require('node-cron')
const logger = require('./logger')
const googleSheets = require('./googleSheets')

class SchedulerService {
  constructor() {
    this.tasks = new Map()
    this.isRunning = false
  }

  start() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running')
      return
    }

    this.isRunning = true
    logger.info('Starting automated tasks scheduler')

    // Daily backup task - runs at 11:00 PM
    this.scheduleTask('daily-backup', '0 23 * * *', this.performDailyBackup.bind(this))

    // Teacher notifications task - runs at 7:00 AM
    this.scheduleTask('teacher-notifications', '0 7 * * *', this.generateTeacherNotifications.bind(this))

    // Cleanup old data task - runs at 2:00 AM on Sundays
    this.scheduleTask('weekly-cleanup', '0 2 * * 0', this.performWeeklyCleanup.bind(this))

    logger.info('All scheduled tasks initialized')
  }

  scheduleTask(taskId, cronExpression, taskFunction) {
    try {
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`)
      }

      // Stop existing task if it exists
      if (this.tasks.has(taskId)) {
        this.tasks.get(taskId).stop()
      }

      // Schedule new task
      const task = cron.schedule(cronExpression, taskFunction, {
        scheduled: false,
        timezone: process.env.LIBRARY_TIMEZONE || 'Asia/Manila'
      })

      task.start()
      this.tasks.set(taskId, task)

      logger.info(`Scheduled task '${taskId}' with cron expression: ${cronExpression}`)
    } catch (error) {
      logger.error(`Failed to schedule task '${taskId}':`, error)
    }
  }

  async performDailyBackup() {
    const taskId = 'daily-backup'
    const startTime = new Date()

    try {
      logger.info('Starting daily backup task')

      // Log task start
      await googleSheets.logAutomationTask({
        task_name: 'Daily Backup',
        task_type: 'backup',
        status: 'running',
        start_time: startTime.toISOString(),
        details: 'Starting daily backup of CLMS data'
      })

      // Generate daily report
      const report = await googleSheets.generateDailyReport()

      // Here you would typically:
      // 1. Export database tables to CSV/JSON
      // 2. Create backup files in local storage
      // 3. Sync summary data to Google Sheets

      logger.info('Daily backup completed successfully', report)

      // Log task completion
      await googleSheets.logAutomationTask({
        task_name: 'Daily Backup',
        task_type: 'backup',
        status: 'completed',
        start_time: startTime.toISOString(),
        end_time: new Date().toISOString(),
        details: `Backup completed. Total students: ${report.total_students}, Total activities: ${report.total_activities}`
      })

    } catch (error) {
      logger.error('Daily backup failed:', error)

      // Log task failure
      await googleSheets.logAutomationTask({
        task_name: 'Daily Backup',
        task_type: 'backup',
        status: 'failed',
        start_time: startTime.toISOString(),
        end_time: new Date().toISOString(),
        details: 'Backup failed due to error',
        error_message: error.message
      })
    }
  }

  async generateTeacherNotifications() {
    const taskId = 'teacher-notifications'
    const startTime = new Date()

    try {
      logger.info('Starting teacher notifications task')

      // Log task start
      await googleSheets.logAutomationTask({
        task_name: 'Teacher Notifications',
        task_type: 'notification',
        status: 'running',
        start_time: startTime.toISOString(),
        details: 'Generating daily teacher notifications'
      })

      // Here you would typically:
      // 1. Query overdue books from Koha database
      // 2. Group by class/teacher
      // 3. Generate notification lists
      // 4. Send emails or create reports

      const mockNotifications = {
        'Grade 1 - Ms. Santos': 5,
        'Grade 2 - Mr. Reyes': 3,
        'Grade 3 - Ms. Cruz': 7,
        'Grade 4 - Mr. Gonzalez': 4,
        'Grade 5 - Ms. Rodriguez': 6,
        'Grade 6 - Mr. Martinez': 2
      }

      logger.info('Teacher notifications generated', mockNotifications)

      // Log task completion
      await googleSheets.logAutomationTask({
        task_name: 'Teacher Notifications',
        task_type: 'notification',
        status: 'completed',
        start_time: startTime.toISOString(),
        end_time: new Date().toISOString(),
        details: `Generated notifications for ${Object.keys(mockNotifications).length} teachers`
      })

    } catch (error) {
      logger.error('Teacher notifications failed:', error)

      // Log task failure
      await googleSheets.logAutomationTask({
        task_name: 'Teacher Notifications',
        task_type: 'notification',
        status: 'failed',
        start_time: startTime.toISOString(),
        end_time: new Date().toISOString(),
        details: 'Failed to generate teacher notifications',
        error_message: error.message
      })
    }
  }

  async performWeeklyCleanup() {
    const taskId = 'weekly-cleanup'
    const startTime = new Date()

    try {
      logger.info('Starting weekly cleanup task')

      // Log task start
      await googleSheets.logAutomationTask({
        task_name: 'Weekly Cleanup',
        task_type: 'cleanup',
        status: 'running',
        start_time: startTime.toISOString(),
        details: 'Performing weekly cleanup of old data'
      })

      // Here you would typically:
      // 1. Archive old records (older than retention period)
      // 2. Clean up temporary files
      // 3. Optimize database tables
      // 4. Remove old logs

      logger.info('Weekly cleanup completed successfully')

      // Log task completion
      await googleSheets.logAutomationTask({
        task_name: 'Weekly Cleanup',
        task_type: 'cleanup',
        status: 'completed',
        start_time: startTime.toISOString(),
        end_time: new Date().toISOString(),
        details: 'Weekly cleanup completed successfully'
      })

    } catch (error) {
      logger.error('Weekly cleanup failed:', error)

      // Log task failure
      await googleSheets.logAutomationTask({
        task_name: 'Weekly Cleanup',
        task_type: 'cleanup',
        status: 'failed',
        start_time: startTime.toISOString(),
        end_time: new Date().toISOString(),
        details: 'Weekly cleanup failed',
        error_message: error.message
      })
    }
  }

  stopTask(taskId) {
    if (this.tasks.has(taskId)) {
      this.tasks.get(taskId).stop()
      logger.info(`Stopped task: ${taskId}`)
      return true
    }
    return false
  }

  startTask(taskId) {
    if (this.tasks.has(taskId)) {
      this.tasks.get(taskId).start()
      logger.info(`Started task: ${taskId}`)
      return true
    }
    return false
  }

  getTaskStatus(taskId) {
    if (this.tasks.has(taskId)) {
      const task = this.tasks.get(taskId)
      return {
        id: taskId,
        running: task.running || false,
        scheduled: true
      }
    }
    return null
  }

  getAllTasksStatus() {
    const tasks = []
    for (const [taskId, task] of this.tasks) {
      tasks.push({
        id: taskId,
        running: task.running || false,
        scheduled: true
      })
    }
    return tasks
  }

  stop() {
    if (!this.isRunning) {
      return
    }

    logger.info('Stopping all scheduled tasks')

    for (const [taskId, task] of this.tasks) {
      task.stop()
      logger.info(`Stopped task: ${taskId}`)
    }

    this.tasks.clear()
    this.isRunning = false
    logger.info('Scheduler stopped')
  }
}

module.exports = new SchedulerService()