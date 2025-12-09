# CLMS Barcode Scanner

A standalone Electron application that captures barcode scans **even when minimized to the system tray**. This solves the browser limitation where barcode scanning doesn't work when the browser is minimized.

## Features

- 🔒 **Background Scanning** - Captures barcodes even when minimized
- 🖥️ **System Tray** - Runs in the background with tray icon
- 🔔 **Desktop Notifications** - Shows scan results as notifications
- 📊 **Scan History** - View recent scans in the app

## Requirements

- Node.js 18 or higher
- Windows 10/11 (for global keyboard capture)
- CLMS Backend server running

## Installation

1. **Navigate to the BarcodeScanner folder:**

   ```bash
   cd BarcodeScanner
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

   > Note: The `uiohook-napi` package requires native compilation. If you encounter issues, ensure you have the necessary build tools installed.

3. **Run the application:**
   ```bash
   npm start
   ```

## Usage

1. **Login** - Enter your CLMS librarian credentials and server URL
2. **Minimize** - Click "Minimize to Tray" to run in background
3. **Scan** - Use your barcode scanner anywhere - the app captures all keyboard input
4. **View Results** - Desktop notifications show scan results, or open the app to see history

## Configuration

- **Server URL**: Your CLMS backend server (e.g., `http://192.168.0.126:3001`)
- **Enable Scanning**: Toggle barcode detection on/off
- **Show Notifications**: Toggle desktop notifications

## Building for Distribution

To create a standalone executable:

```bash
npm run build
```

This creates an installer in the `dist/` folder.

## How It Works

The app uses `uiohook-napi` to capture **global keyboard events** at the system level. This means:

1. Barcode scanners act as keyboard devices
2. The app captures all key presses system-wide
3. Rapid key sequences (typical of scanners) are detected as barcodes
4. Pressing Enter submits the barcode to the CLMS server

## Troubleshooting

### Scanner not detecting barcodes?

- Make sure you're logged in
- Check that "Enable Scanning" is checked
- Verify your barcode scanner is in "keyboard wedge" mode
- Test by typing a barcode manually and pressing Enter

### Can't login?

- Verify the server URL is correct
- Ensure the backend server is running
- Check your network connection

### Build errors?

- Install build tools: `npm install -g windows-build-tools` (Windows)
- Or use Visual Studio Build Tools with C++ workload

## Architecture

```
BarcodeScanner/
├── main.js         # Electron main process (tray, keyboard hook)
├── preload.js      # IPC bridge for renderer
├── renderer.html   # Login/status UI
├── renderer.js     # UI logic
├── styles.css      # Styling
└── package.json    # Dependencies
```

## Network Setup

For multi-PC setups:

1. Run this scanner app on the PC with the barcode scanner
2. Have Kiosk displays open on other PCs
3. All PCs must be on the same network
4. Configure the server URL to point to the Backend server IP
