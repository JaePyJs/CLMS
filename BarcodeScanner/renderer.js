// DOM Elements
const loginSection = document.getElementById("login-section");
const connectedSection = document.getElementById("connected-section");
const serverUrlInput = document.getElementById("serverUrl");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const testConnectionBtn = document.getElementById("testConnection");
const connectedUser = document.getElementById("connectedUser");
const enableScanningCheckbox = document.getElementById("enableScanning");
const showNotificationsCheckbox = document.getElementById("showNotifications");
const scanLog = document.getElementById("scanLog");
const minimizeBtn = document.getElementById("minimizeBtn");
const logoutBtn = document.getElementById("logoutBtn");

// State
let scanHistory = [];

// Initialize
async function init() {
  const config = await window.electronAPI.getConfig();

  if (config.isLoggedIn) {
    showConnectedSection();
  }

  serverUrlInput.value = config.serverUrl || "http://192.168.0.126:3001";
  enableScanningCheckbox.checked = config.enabled;
  showNotificationsCheckbox.checked = config.showNotifications;
}

// Show/hide sections
function showLoginSection() {
  loginSection.classList.remove("hidden");
  connectedSection.classList.add("hidden");
}

function showConnectedSection() {
  loginSection.classList.add("hidden");
  connectedSection.classList.remove("hidden");
}

// Test connection
testConnectionBtn.addEventListener("click", async () => {
  testConnectionBtn.textContent = "Testing...";
  testConnectionBtn.disabled = true;

  try {
    const result = await window.electronAPI.testConnection(
      serverUrlInput.value
    );
    if (result.success) {
      testConnectionBtn.textContent = "✓ Connected!";
      setTimeout(() => {
        testConnectionBtn.textContent = "Test Connection";
        testConnectionBtn.disabled = false;
      }, 2000);
    } else {
      testConnectionBtn.textContent = "✗ Failed";
      setTimeout(() => {
        testConnectionBtn.textContent = "Test Connection";
        testConnectionBtn.disabled = false;
      }, 2000);
    }
  } catch (e) {
    testConnectionBtn.textContent = "✗ Error";
    setTimeout(() => {
      testConnectionBtn.textContent = "Test Connection";
      testConnectionBtn.disabled = false;
    }, 2000);
  }
});

// Login
loginBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const serverUrl = serverUrlInput.value.trim();

  if (!username || !password) {
    showError("Please enter username and password");
    return;
  }

  loginBtn.textContent = "Logging in...";
  loginBtn.disabled = true;
  hideError();

  try {
    const result = await window.electronAPI.login({
      username,
      password,
      serverUrl,
    });

    if (result.success) {
      connectedUser.textContent = `Logged in as: ${result.user.username}`;
      showConnectedSection();
    } else {
      showError(result.message || "Login failed");
    }
  } catch (e) {
    showError("Connection failed. Check server URL.");
  } finally {
    loginBtn.textContent = "Login & Start Scanning";
    loginBtn.disabled = false;
  }
});

// Allow Enter key to login
passwordInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    loginBtn.click();
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await window.electronAPI.logout();
  showLoginSection();
  passwordInput.value = "";
});

// Minimize to tray
minimizeBtn.addEventListener("click", () => {
  window.close();
});

// Settings changes
enableScanningCheckbox.addEventListener("change", async () => {
  await window.electronAPI.setConfig({
    enabled: enableScanningCheckbox.checked,
  });
});

showNotificationsCheckbox.addEventListener("change", async () => {
  await window.electronAPI.setConfig({
    showNotifications: showNotificationsCheckbox.checked,
  });
});

// Handle scan results
window.electronAPI.onScanResult((data) => {
  addScanToLog(data);
});

function addScanToLog(data) {
  const time = new Date().toLocaleTimeString();
  const isSuccess = data.success;
  const message = data.success
    ? data.data?.student?.name || "Scan successful"
    : data.message || "Scan failed";

  scanHistory.unshift({ time, success: isSuccess, message });

  // Keep only last 10 scans
  if (scanHistory.length > 10) {
    scanHistory.pop();
  }

  renderScanLog();
}

function renderScanLog() {
  if (scanHistory.length === 0) {
    scanLog.innerHTML = '<p class="empty-message">No scans yet...</p>';
    return;
  }

  scanLog.innerHTML = scanHistory
    .map(
      (scan) => `
    <div class="scan-item ${scan.success ? "success" : "error"}">
      <span>${scan.success ? "✓" : "✗"} ${scan.message}</span>
      <span class="time">${scan.time}</span>
    </div>
  `
    )
    .join("");
}

// Error handling
function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

function hideError() {
  loginError.classList.add("hidden");
}

// Initialize on load
init();
