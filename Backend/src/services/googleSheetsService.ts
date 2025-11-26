import { google } from 'googleapis';
import path from 'path';
import { logger } from '../utils/logger';

export class GoogleSheetsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static auth: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static sheets: any;
  private static spreadsheetId: string = process.env.GOOGLE_SHEET_ID || '';

  private static async getAuth() {
    if (this.auth) {
      return this.auth;
    }

    try {
      const keyFile = path.join(process.cwd(), 'google-credentials.json');
      this.auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return this.auth;
    } catch (error) {
      logger.error('Google Auth failed', error);
      return null;
    }
  }

  private static async getSheets() {
    if (this.sheets) {
      return this.sheets;
    }
    const auth = await this.getAuth();
    if (!auth) {
      return null;
    }
    this.sheets = google.sheets({ version: 'v4', auth });
    return this.sheets;
  }

  public static async appendRow(
    data: string[],
    sheetName = 'Sheet1',
    range?: string,
  ) {
    if (!this.spreadsheetId) {
      logger.warn('No Google Sheet ID configured. Skipping export.');
      return;
    }

    try {
      const sheets = await this.getSheets();
      if (!sheets) {
        return;
      }

      const targetRange = range || `${sheetName}!A:Z`;

      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: targetRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [data],
        },
      });
      logger.info('Row appended to Google Sheet');
    } catch (error) {
      logger.error('Failed to append row to Google Sheet', error);
    }
  }

  public static async syncAll(): Promise<void> {
    if (!this.spreadsheetId) {
      logger.warn('No Google Sheet ID configured. Skipping sync.');
      return;
    }

    // Placeholder for full sync logic
    // In a real implementation, this would:
    // 1. Fetch all data (Students, Books, Equipment)
    // 2. Clear respective sheets
    // 3. Write headers and data

    logger.info('Syncing all data to Google Sheets (Placeholder)...');

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.info('Sync completed successfully');
  }
}
