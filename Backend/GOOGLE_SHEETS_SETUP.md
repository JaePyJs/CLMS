# Google Sheets Integration Setup Guide

## 1. Google Cloud Service Account Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Enable the **Google Sheets API**.
4. Go to **IAM & Admin** > **Service Accounts**.
5. Click **Create Service Account**.
6. Name it something recognizable like `clms-sheets-integration`.
7. Grant the service account **Editor** role (optional but recommended for writing to sheets).
8. Create a key:
   - Click on the newly created service account.
   - Go to the **Keys** tab.
   - Click **Add Key** > **Create new key**.
   - Select **JSON**.
   - This will download a JSON file.

## 2. Install Credentials

1. Rename the downloaded JSON file to `google-credentials.json`.
2. Move this file to the `Backend/` folder of the project.
   - Path: `Backend/google-credentials.json`
3. **IMPORTANT**: Ensure this file is ignored by Git (it should already be in `.gitignore`).

## 3. Share Your Google Sheet

1. Open the Google Sheet you want to use for attendance.
2. Click the **Share** button in the top right.
3. Paste the service account email address (e.g., `clms-sheets-integration@your-project-id.iam.gserviceaccount.com`).
4. Give it **Editor** access.
5. Uncheck "Notify people" if desired.
6. Click **Share**.

## 4. Get Spreadsheet ID and Sheet Name

- **Spreadsheet ID**: Found in the URL of your Google Sheet.
  - URL format: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...`
  - Example ID: `1BxiMvs0XRA5nFK...`
- **Sheet Name**: The name of the tab at the bottom (e.g., "Sheet1", "Attendance 2023").

## 5. Usage in App

1. Navigate to the **Attendance** tab in the CLMS application.
2. Click the **Google Sheets Sync** button.
3. Enter your **Spreadsheet ID** and **Sheet Name**.
4. Use **Import** to pull data from Sheets to CLMS.
5. Use **Export** to push CLMS data to Sheets.

## Troubleshooting

- **Error 403 (Permission Denied)**: Ensure you shared the sheet with the correct service account email.
- **Error 404 (Not Found)**: Check the Spreadsheet ID.
- **"Sheet is empty"**: Check the Sheet Name (tab name) is correct and matches exactly (case-sensitive).
- **Date/Time Errors**: Ensure your Google Sheet dates are in a standard format (YYYY-MM-DD, ISO, or standard locale date).

## Note for Developers

- The backend relies on `Backend/google-credentials.json` being present.
- Environment variables in `Backend/.env` can override default paths if needed.
