const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  Notification,
  ipcMain,
} = require("electron");
const path = require("path");
const { io } = require("socket.io-client");

// Configuration - can be overridden by environment variables
let CONFIG = {
  serverUrl: process.env.CLMS_SERVER_URL || "http://localhost:3001",
  pcId: process.env.CLMS_PC_ID || "PC1",
  enabled: true,
  showNotifications: true,
};

let mainWindow = null;
let tray = null;
let barcodeBuffer = "";
let barcodeTimeout = null;
let socket = null;
let connectionState = "disconnected"; // 'disconnected', 'connecting', 'connected', 'error'
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

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
  const iconPath = path.join(__dirname, "icon.png");
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = createDefaultIcon("green");
    }
  } catch (e) {
    trayIcon = createDefaultIcon("green");
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

function createDefaultIcon(color = "green") {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const colors = {
    green: [76, 175, 80], // Connected
    yellow: [255, 193, 7], // Connecting
    red: [244, 67, 54], // Disconnected
  };
  const rgb = colors[color] || colors.green;

  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    const centerX = size / 2;
    const centerY = size / 2;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    if (dist < size / 2 - 1) {
      canvas[i * 4] = rgb[0]; // R
      canvas[i * 4 + 1] = rgb[1]; // G
      canvas[i * 4 + 2] = rgb[2]; // B
      canvas[i * 4 + 3] = 255; // A
    } else {
      canvas[i * 4] = 0;
      canvas[i * 4 + 1] = 0;
      canvas[i * 4 + 2] = 0;
      canvas[i * 4 + 3] = 0;
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function updateTrayIcon() {
  if (!tray) return;

  let color = "red";
  if (connectionState === "connected") color = "green";
  else if (connectionState === "connecting") color = "yellow";

  const icon = createDefaultIcon(color);
  tray.setImage(icon.resize({ width: 16, height: 16 }));
}

function updateTrayMenu() {
  const statusText = {
    disconnected: "❌ Disconnected",
    connecting: "🟡 Connecting...",
    connected: "✅ Connected",
    error: "⚠️ Error",
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `CLMS Scanner - ${CONFIG.pcId}`,
      enabled: false,
    },
    {
      label: statusText[connectionState] || "Unknown",
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
      label: "Reconnect",
      click: () => {
        if (socket) {
          socket.disconnect();
        }
        connectWebSocket();
      },
    },
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
        if (socket) {
          socket.disconnect();
        }
        app.quit();
      },
    },
  ]);

  if (tray) {
    tray.setContextMenu(contextMenu);
  }
}

// WebSocket connection
function connectWebSocket() {
  if (socket && socket.connected) {
    console.log("WebSocket already connected");
    return;
  }

  connectionState = "connecting";
  updateTrayIcon();
  updateTrayMenu();

  console.log(`Connecting to WebSocket server: ${CONFIG.serverUrl}`);

  socket = io(CONFIG.serverUrl, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    auth: {
      kioskMode: true, // Use kiosk mode for unauthenticated access
      pcId: CONFIG.pcId,
    },
    query: {
      kioskMode: "true",
      pcId: CONFIG.pcId,
    },
  });

  socket.on("connect", () => {
    console.log("WebSocket connected:", socket.id);
    connectionState = "connected";
    reconnectAttempts = 0;
    updateTrayIcon();
    updateTrayMenu();
    showNotification("Connected", `Scanner connected to server`);

    // Subscribe to scanner room
    socket.emit("subscribe", { subscription: "scanner" });
    socket.emit("subscribe", { subscription: "attendance" });
  });

  socket.on("disconnect", (reason) => {
    console.log("WebSocket disconnected:", reason);
    connectionState = "disconnected";
    updateTrayIcon();
    updateTrayMenu();
  });

  socket.on("connect_error", (error) => {
    console.error("WebSocket connection error:", error.message);
    connectionState = "error";
    reconnectAttempts++;
    updateTrayIcon();
    updateTrayMenu();

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      showNotification(
        "Connection Failed",
        `Cannot connect to server at ${CONFIG.serverUrl}`
      );
    }
  });

  socket.on("welcome", (data) => {
    console.log("Server welcome:", data);
  });

  socket.on("subscription_confirmed", (data) => {
    console.log("Subscription confirmed:", data.subscription);
  });

  // Handle scan results from server
  socket.on("scan:result", (result) => {
    console.log("Scan result:", result);

    if (result.success) {
      const message = result.message || "Scan successful";
      showNotification(
        result.action === "checkin" ? "Check In" : "Check Out",
        message
      );

      // Flash tray icon
      flashTrayIcon();
    } else {
      showNotification("Scan Info", result.message || "Scan processed");
    }

    // Send to renderer
    if (mainWindow) {
      mainWindow.webContents.send("scan-result", result);
    }
  });

  // Handle attendance events (for logging)
  socket.on("message", (msg) => {
    if (msg.type === "student_checkin" || msg.type === "attendance:checkin") {
      console.log("Student checked in:", msg.data?.studentName);
    } else if (
      msg.type === "student_checkout" ||
      msg.type === "attendance:checkout"
    ) {
      console.log("Student checked out:", msg.data?.studentName);
    }
  });
}

function flashTrayIcon() {
  if (!tray) return;

  // Quick flash green -> original state
  const originalState = connectionState;
  updateTrayIcon();

  setTimeout(() => {
    connectionState = originalState;
    updateTrayIcon();
  }, 200);
}

// Global keyboard hook for barcode scanning
function setupGlobalKeyboardHook() {
  const { uIOhook } = require("uiohook-napi");

  uIOhook.on("keydown", (e) => {
    if (!CONFIG.enabled) return;

    const char = keycodeToChar(e.keycode, e.shiftKey);

    if (char === "ENTER") {
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

      if (barcodeTimeout) {
        clearTimeout(barcodeTimeout);
      }

      // Auto-submit after 150ms of no input (scanner typically sends rapidly)
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

// Convert keycode to character
function keycodeToChar(keycode, shift) {
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
    // Letters
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

// Process barcode scan via WebSocket
function processScan(barcode) {
  console.log("Processing barcode:", barcode);

  if (!socket || !socket.connected) {
    showNotification("Not Connected", "Please wait for server connection");
    return;
  }

  // Emit barcode scan event to server
  socket.emit("barcode:scanned", {
    barcode: barcode,
    timestamp: Date.now(),
    pcId: CONFIG.pcId,
  });

  console.log("Barcode sent to server:", barcode);
}

// Show notification
function showNotification(title, body) {
  if (!CONFIG.showNotifications) return;

  if (Notification.isSupported()) {
    new Notification({ title, body, silent: true }).show();
  }
}

// IPC handlers for renderer
ipcMain.handle("get-config", () => {
  return {
    ...CONFIG,
    connectionState,
    socketId: socket?.id || null,
  };
});

ipcMain.handle("set-config", (event, newConfig) => {
  CONFIG = { ...CONFIG, ...newConfig };
  updateTrayMenu();

  // Reconnect if server URL changed
  if (newConfig.serverUrl && socket) {
    socket.disconnect();
    connectWebSocket();
  }

  return { success: true };
});

ipcMain.handle("test-connection", async () => {
  if (socket && socket.connected) {
    return { success: true, socketId: socket.id };
  }
  return { success: false, message: "Not connected" };
});

ipcMain.handle("reconnect", () => {
  if (socket) {
    socket.disconnect();
  }
  connectWebSocket();
  return { success: true };
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Connect to WebSocket server
  connectWebSocket();

  // Setup global keyboard hook
  try {
    setupGlobalKeyboardHook();
  } catch (e) {
    console.warn("Failed to setup global keyboard hook:", e.message);
    showNotification(
      "Scanner Warning",
      "Global keyboard hook failed. Scanner may not work when app is minimized."
    );
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
  if (socket) {
    socket.disconnect();
  }
});
