# ⚡ Quick Start Checklist

## 🎯 Your Mission Right Now

- [ ] **Open Terminal 1** (PowerShell)
  - [ ] Navigate to Backend: `cd "c:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Backend"`
  - [ ] Start server: `npm run dev`
  - [ ] Wait for "Server started" message
  - [ ] ✅ Keep this terminal open!

- [ ] **Open Terminal 2** (PowerShell)
  - [ ] Navigate to Frontend: `cd "c:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend"`
  - [ ] Start server: `npm run dev`
  - [ ] Wait for "Local: http://localhost:3000" message
  - [ ] ✅ Keep this terminal open!

- [ ] **Verify in Browser**
  - [ ] Open http://localhost:3000
  - [ ] Press F12 to open DevTools
  - [ ] Check Console tab for errors
  - [ ] Look for "WebSocket connected" messages

- [ ] **Report Back**
  - [ ] Say "Both servers running" → I'll start testing
  - [ ] OR describe any errors you see

---

## 🚨 If You See Errors

### "Cannot find module" or "npm not found"

```powershell
npm install
```

### "Port already in use"

```powershell
# Find and kill the process
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
# Or change the port in .env
```

### "Database connection failed"

**Good news:** The app will run without database in dev mode. Just continue.

---

## ⏱️ Estimated Time: 5 minutes

Ready? Go! 🚀
