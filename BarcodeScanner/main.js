const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  Notification,
  globalShortcut,
  ipcMain,
} = require("electron");
const path = require("path");
const http = require("http");
const https = require("https");

// Configuration
let CONFIG = {
  serverUrl: "http://192.168.0.126:3001",
  apiEndpoint: "/api/v1/self-service/scan",
  enabled: true,
  showNotifications: true,
  authToken: null, // Will be set after login
};

let mainWindow = null;
let tray = null;
let barcodeBuffer = "";
let barcodeTimeout = null;
let isLoggedIn = false;

// Create the main window (hidden by default)
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 550,
    show: false,
    frame: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "icon.png"),
  });

  mainWindow.loadFile("renderer.html");

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

// Create system tray
function createTray() {
  // Create a simple icon (green circle for active, red for inactive)
  const iconPath = path.join(__dirname, "icon.png");
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      // Create a simple colored icon if file doesn't exist
      trayIcon = createDefaultIcon();
    }
  } catch (e) {
    trayIcon = createDefaultIcon();
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  updateTrayMenu();

  tray.setToolTip("CLMS Barcode Scanner");

  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createDefaultIcon() {
  // Create a simple 16x16 green icon
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    const centerX = size / 2;
    const centerY = size / 2;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    if (dist < size / 2 - 1) {
      // Green circle
      canvas[i * 4] = 76; // R
      canvas[i * 4 + 1] = 175; // G
      canvas[i * 4 + 2] = 80; // B
      canvas[i * 4 + 3] = 255; // A
    } else {
      // Transparent
      canvas[i * 4] = 0;
      canvas[i * 4 + 1] = 0;
      canvas[i * 4 + 2] = 0;
      canvas[i * 4 + 3] = 0;
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `CLMS Barcode Scanner ${isLoggedIn ? "(Connected)" : "(Not Connected)"}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: CONFIG.enabled ? "✓ Scanning Enabled" : "✗ Scanning Disabled",
      click: () => {
        CONFIG.enabled = !CONFIG.enabled;
        updateTrayMenu();
        showNotification(
          CONFIG.enabled ? "Scanner Enabled" : "Scanner Disabled",
          CONFIG.enabled
            ? "Now listening for barcodes"
            : "Barcode scanning paused"
        );
      },
    },
    {
      label: CONFIG.showNotifications
        ? "✓ Show Notifications"
        : "✗ Show Notifications",
      click: () => {
        CONFIG.showNotifications = !CONFIG.showNotifications;
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Open Settings",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  if (tray) {
    tray.setContextMenu(contextMenu);
  }
}

// Global keyboard hook for barcode scanning
function setupGlobalKeyboardHook() {
  // Use a raw keyboard hook approach
  // We'll capture key events globally

  const { uIOhook, UiohookKey } = require("uiohook-napi");

  uIOhook.on("keydown", (e) => {
    if (!CONFIG.enabled || !isLoggedIn) return;

    // Convert keycode to character
    const char = keycodeToChar(e.keycode, e.shiftKey);

    if (char === "ENTER") {
      // Process barcode
      if (barcodeBuffer.length >= 3) {
        processScan(barcodeBuffer);
      }
      barcodeBuffer = "";
      if (barcodeTimeout) {
        clearTimeout(barcodeTimeout);
        barcodeTimeout = null;
      }
      return;
    }

    if (char && char.length === 1) {
      barcodeBuffer += char;

      // Clear timeout
      if (barcodeTimeout) {
        clearTimeout(barcodeTimeout);
      }

      // Auto-submit after 150ms of no input
      barcodeTimeout = setTimeout(() => {
        if (barcodeBuffer.length >= 6) {
          processScan(barcodeBuffer);
        }
        barcodeBuffer = "";
      }, 150);
    }
  });

  uIOhook.start();

  console.log("Global keyboard hook started");
}

// Alternative: Use Electron's globalShortcut for basic detection
// This is a fallback that works without native modules
function setupBasicKeyboardCapture() {
  // This won't work when minimized, but we'll use it as fallback
  console.log("Using basic keyboard capture (limited functionality)");
}

// Convert keycode to character
function keycodeToChar(keycode, shift) {
  // Common keycodes mapping
  const keycodeMap = {
    // Numbers
    2: "1",
    3: "2",
    4: "3",
    5: "4",
    6: "5",
    7: "6",
    8: "7",
    9: "8",
    10: "9",
    11: "0",
    // Letters (lowercase)
    16: "q",
    17: "w",
    18: "e",
    19: "r",
    20: "t",
    21: "y",
    22: "u",
    23: "i",
    24: "o",
    25: "p",
    30: "a",
    31: "s",
    32: "d",
    33: "f",
    34: "g",
    35: "h",
    36: "j",
    37: "k",
    38: "l",
    44: "z",
    45: "x",
    46: "c",
    47: "v",
    48: "b",
    49: "n",
    50: "m",
    // Special
    28: "ENTER",
    57: " ",
    12: "-",
  };

  let char = keycodeMap[keycode];
  if (char && char.length === 1 && shift) {
    char = char.toUpperCase();
  }
  return char;
}

// Process barcode scan
async function processScan(barcode) {
  console.log("Processing barcode:", barcode);

  if (!CONFIG.authToken) {
    showNotification("Not Logged In", "Please login to scan barcodes");
    return;
  }

  try {
    const response = await makeRequest(
      `${CONFIG.serverUrl}${CONFIG.apiEndpoint}`,
      "POST",
      { scanData: barcode },
      { Authorization: `Bearer ${CONFIG.authToken}` }
    );

    if (response.success) {
      const studentName = response.student?.name || "Student";
      const action = response.message?.includes("Checked out")
        ? "checked out"
        : "checked in";
      showNotification("Scan Successful", `${studentName} ${action}`);

      // Send to renderer
      if (mainWindow) {
        mainWindow.webContents.send("scan-result", {
          success: true,
          data: response,
        });
      }
    } else {
      showNotification("Scan Info", response.message || "Action completed");
      if (mainWindow) {
        mainWindow.webContents.send("scan-result", {
          success: false,
          message: response.message,
        });
      }
    }
  } catch (error) {
    console.error("Scan error:", error);
    showNotification("Scan Error", error.message || "Failed to process scan");
  }
}

// HTTP request helper
function makeRequest(url, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ success: false, message: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Show notification
function showNotification(title, body) {
  if (!CONFIG.showNotifications) return;

  if (Notification.isSupported()) {
    new Notification({ title, body, silent: true }).show();
  }
}

// IPC handlers
ipcMain.handle("login", async (event, { username, password, serverUrl }) => {
  CONFIG.serverUrl = serverUrl || CONFIG.serverUrl;

  try {
    const response = await makeRequest(
      `${CONFIG.serverUrl}/api/v1/auth/login`,
      "POST",
      { username, password }
    );

    if (response.success && response.data?.accessToken) {
      CONFIG.authToken = response.data.accessToken;
      isLoggedIn = true;
      updateTrayMenu();
      return { success: true, user: response.data.user };
    } else {
      return { success: false, message: response.message || "Login failed" };
    }
  } catch (error) {
    return { success: false, message: error.message || "Connection failed" };
  }
});

ipcMain.handle("logout", async () => {
  CONFIG.authToken = null;
  isLoggedIn = false;
  updateTrayMenu();
  return { success: true };
});

ipcMain.handle("get-config", () => {
  return { ...CONFIG, isLoggedIn };
});

ipcMain.handle("set-config", (event, newConfig) => {
  CONFIG = { ...CONFIG, ...newConfig };
  updateTrayMenu();
  return { success: true };
});

ipcMain.handle("test-connection", async (event, serverUrl) => {
  try {
    const response = await makeRequest(`${serverUrl}/health`, "GET");
    return { success: true, data: response };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Try to setup global keyboard hook
  try {
    setupGlobalKeyboardHook();
  } catch (e) {
    console.warn("Failed to setup global keyboard hook:", e.message);
    console.log("The scanner will work when the app window is focused.");
    setupBasicKeyboardCapture();
  }

  // Show window on first launch
  mainWindow.show();
});

app.on("window-all-closed", () => {
  // Don't quit on window close - keep running in tray
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
});
