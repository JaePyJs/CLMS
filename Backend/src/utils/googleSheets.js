const { GoogleSpreadsheet } = require('google-spreadsheet');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class GoogleSheetsService {
  constructor() {
    this.doc = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (this.isInitialized) {
        return this.doc;
      }

      // Load credentials
      const credentialsPath = path.resolve(
        __dirname,
        '../../',
        process.env.GOOGLE_PRIVATE_KEY_PATH,
      );
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      // Initialize the spreadsheet
      this.doc = new GoogleSpreadsheet(
        process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      );

      // Authenticate with service account
      await this.doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: credentials.private_key,
      });

      // Load spreadsheet info
      await this.doc.loadInfo();

      this.isInitialized = true;
      logger.info('Google Sheets integration initialized successfully');
      return this.doc;
    } catch (error) {
      logger.error('Failed to initialize Google Sheets:', error);
      throw error;
    }
  }

  async appendStudentActivity(activityData) {
    try {
      await this.initialize();
      const sheet =
        this.doc.sheetsByTitle['Student Activities'] ||
        (await this.createStudentActivitiesSheet());

      const row = {
        timestamp: new Date().toISOString(),
        student_id: activityData.student_id,
        student_name: activityData.student_name,
        grade_level: activityData.grade_level,
        grade_category: activityData.grade_category,
        activity_type: activityData.activity_type,
        equipment_id: activityData.equipment_id || '',
        start_time: activityData.start_time,
        end_time: activityData.end_time || '',
        duration_minutes: activityData.duration_minutes || '',
        time_limit_minutes: activityData.time_limit_minutes || '',
        status: activityData.status,
        processed_by: activityData.processed_by || 'System',
      };

      await sheet.addRow(row);
      logger.info(
        `Student activity synced to Google Sheets: ${activityData.student_id}`,
      );
      return true;
    } catch (error) {
      logger.error(
        'Failed to append student activity to Google Sheets:',
        error,
      );
      throw error;
    }
  }

  async appendEquipmentSession(sessionData) {
    try {
      await this.initialize();
      const sheet =
        this.doc.sheetsByTitle['Equipment Sessions'] ||
        (await this.createEquipmentSessionsSheet());

      const row = {
        timestamp: new Date().toISOString(),
        equipment_type: sessionData.equipment_type,
        equipment_id: sessionData.equipment_id,
        student_id: sessionData.student_id,
        session_start: sessionData.session_start,
        session_end: sessionData.session_end || '',
        time_limit_minutes: sessionData.time_limit_minutes,
        status: sessionData.status,
      };

      await sheet.addRow(row);
      logger.info(
        `Equipment session synced to Google Sheets: ${sessionData.equipment_id}`,
      );
      return true;
    } catch (error) {
      logger.error(
        'Failed to append equipment session to Google Sheets:',
        error,
      );
      throw error;
    }
  }

  async logAutomationTask(taskData) {
    try {
      await this.initialize();
      const sheet =
        this.doc.sheetsByTitle['Automation Logs'] ||
        (await this.createAutomationLogsSheet());

      const row = {
        timestamp: new Date().toISOString(),
        task_name: taskData.task_name,
        task_type: taskData.task_type,
        status: taskData.status,
        start_time: taskData.start_time,
        end_time: taskData.end_time || '',
        details: taskData.details || '',
        error_message: taskData.error_message || '',
      };

      await sheet.addRow(row);
      logger.info(
        `Automation task logged to Google Sheets: ${taskData.task_name}`,
      );
      return true;
    } catch (error) {
      logger.error('Failed to log automation task to Google Sheets:', error);
      throw error;
    }
  }

  async createStudentActivitiesSheet() {
    try {
      const sheet = await this.doc.addSheet({
        title: 'Student Activities',
        headerValues: [
          'timestamp',
          'student_id',
          'student_name',
          'grade_level',
          'grade_category',
          'activity_type',
          'equipment_id',
          'start_time',
          'end_time',
          'duration_minutes',
          'time_limit_minutes',
          'status',
          'processed_by',
        ],
      });
      logger.info('Created Student Activities sheet in Google Sheets');
      return sheet;
    } catch (error) {
      logger.error('Failed to create Student Activities sheet:', error);
      throw error;
    }
  }

  async createEquipmentSessionsSheet() {
    try {
      const sheet = await this.doc.addSheet({
        title: 'Equipment Sessions',
        headerValues: [
          'timestamp',
          'equipment_type',
          'equipment_id',
          'student_id',
          'session_start',
          'session_end',
          'time_limit_minutes',
          'status',
        ],
      });
      logger.info('Created Equipment Sessions sheet in Google Sheets');
      return sheet;
    } catch (error) {
      logger.error('Failed to create Equipment Sessions sheet:', error);
      throw error;
    }
  }

  async createAutomationLogsSheet() {
    try {
      const sheet = await this.doc.addSheet({
        title: 'Automation Logs',
        headerValues: [
          'timestamp',
          'task_name',
          'task_type',
          'status',
          'start_time',
          'end_time',
          'details',
          'error_message',
        ],
      });
      logger.info('Created Automation Logs sheet in Google Sheets');
      return sheet;
    } catch (error) {
      logger.error('Failed to create Automation Logs sheet:', error);
      throw error;
    }
  }

  async generateDailyReport(date = new Date()) {
    try {
      await this.initialize();
      const activitiesSheet = this.doc.sheetsByTitle['Student Activities'];

      if (!activitiesSheet) {
        throw new Error('Student Activities sheet not found');
      }

      const rows = await activitiesSheet.getRows();
      const today = date.toISOString().split('T')[0];

      const todayActivities = rows.filter(row => {
        const rowDate = row.timestamp.split('T')[0];
        return rowDate === today;
      });

      const report = {
        date: today,
        total_students: new Set(todayActivities.map(row => row.student_id))
          .size,
        total_activities: todayActivities.length,
        by_grade_category: {},
        by_activity_type: {},
        equipment_utilization: {},
      };

      todayActivities.forEach(activity => {
        // Count by grade category
        if (!report.by_grade_category[activity.grade_category]) {
          report.by_grade_category[activity.grade_category] = 0;
        }
        report.by_grade_category[activity.grade_category]++;

        // Count by activity type
        if (!report.by_activity_type[activity.activity_type]) {
          report.by_activity_type[activity.activity_type] = 0;
        }
        report.by_activity_type[activity.activity_type]++;

        // Count equipment usage
        if (activity.equipment_id) {
          if (!report.equipment_utilization[activity.equipment_id]) {
            report.equipment_utilization[activity.equipment_id] = 0;
          }
          report.equipment_utilization[activity.equipment_id]++;
        }
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate daily report:', error);
      throw error;
    }
  }
}

module.exports = new GoogleSheetsService();
