# USB Barcode Scanner Setup Guide

## ✅ What You Have

- 2D USB Barcode/QR Scanner (connected via USB)
- Windows PC (no camera needed!)

## 🔧 How USB Scanners Work

Your USB barcode scanner acts as a **keyboard input device**. When you scan a barcode:

1. The scanner reads the barcode
2. It "types" the barcode data as keyboard input
3. It sends an ENTER key at the end
4. The application captures this input automatically

## 📋 Setup Instructions

### Step 1: Connect Your Scanner

1. Plug your USB scanner into any USB port
2. Windows will automatically recognize it as a keyboard device
3. No drivers needed - it works like a keyboard!

### Step 2: Test Your Scanner

1. Open Notepad
2. Click inside Notepad
3. Scan any barcode
4. You should see the barcode number appear in Notepad followed by a new line
5. **If this works, your scanner is ready!**

### Step 3: Use in CLMS Application

1. Open the CLMS application in your browser
2. Navigate to **Scan Workspace**
3. Select the **"USB Scanner"** tab (it's now the default!)
4. Click **"Activate Scanner"** button
5. Make sure the browser window is focused (click anywhere on the page)
6. Scan any barcode - you'll see:
   - A green pulsing indicator showing it's active
   - Real-time display of what's being read
   - Success notification when a barcode is scanned
   - The barcode will be automatically processed

## 🎯 Using the Scanner

### For Student Check-in:

1. Go to Scan Workspace
2. USB Scanner should be active (green indicator)
3. Scan student ID barcode
4. Student info appears automatically
5. Select action (Computer, Gaming, Books, etc.)
6. Confirm - Done!

### For Book Borrowing:

1. Scan student barcode first
2. Then scan book ISBN barcode
3. System auto-detects it's a book
4. Select "Borrowing" action
5. Confirm - Done!

### For Equipment:

1. Scan student barcode
2. Select equipment type (Computer/Gaming/AVR)
3. Set time limit
4. Start session - Done!

## ⚙️ Scanner Settings

### What Barcodes Are Supported:

- **Student IDs**: Letters + numbers (e.g., STU001, ABC123)
- **Book ISBNs**: 10-13 digit numbers
- **Equipment IDs**: Prefix codes (EQ001, PC001, PS001, AVR001)
- **QR Codes**: Any QR code data
- **Minimum length**: 3 characters

### Scanner Auto-Detection:

The system automatically recognizes:

- **Equipment barcodes**: Start with EQ, PC, PS, or AVR
- **Book barcodes**: 10-13 digit numbers (ISBN format)
- **Student IDs**: Letters + numbers or 6-8 digits

## 🐛 Troubleshooting

### Scanner Not Working?

1. **Test in Notepad first** - If it doesn't work in Notepad, the scanner isn't recognized
2. **Check USB connection** - Try different USB port
3. **Make sure window is focused** - Click on the browser window before scanning
4. **Green light on scanner?** - Some scanners have LED indicators

### Barcode Not Detected?

1. **Check minimum length** - Barcode must be at least 3 characters
2. **Scan speed** - Hold scanner steady, don't scan too fast
3. **Barcode quality** - Make sure barcode is clean and not damaged
4. **Distance** - Most scanners work best 2-6 inches from barcode

### Multiple Scans?

1. **Wait for confirmation** - Wait for success toast before next scan
2. **Scanner configured wrong** - Some scanners can be set to scan multiple times
3. **Check scanner manual** - You may need to configure it to single-scan mode

## 🎮 Advanced Features

### Real-time Feedback:

- **Green pulsing icon** = Scanner active and ready
- **Text appearing** = Scanner is reading barcode
- **Success sound** = Barcode successfully scanned
- **Toast notification** = Shows what was scanned

### Manual Entry (Backup):

If scanner fails:

1. Click "Manual Entry" tab
2. Type barcode manually
3. Press Enter or click Submit

### Offline Mode:

- Works even without internet!
- Scans are queued and synced later
- Yellow badge shows offline status

## 📝 Best Practices

1. **Keep scanner active** - Leave USB Scanner activated during work hours
2. **Focus window** - Always keep browser window in focus
3. **One scan at a time** - Wait for confirmation before next scan
4. **Regular testing** - Test scanner daily in Notepad
5. **Barcode quality** - Print student/equipment barcodes clearly

## 🔊 Audio Feedback

- **Success**: Ascending beep (800Hz → 1200Hz)
- **Error**: Descending beep (400Hz → 200Hz)
- **Volume**: Set in browser or OS volume control

## 📞 Need Help?

If scanner still doesn't work:

1. Check scanner model/manufacturer documentation
2. Verify it's configured as "keyboard wedge" mode
3. Some scanners need configuration barcodes to be scanned first
4. Contact scanner manufacturer for support

---

## 🎉 You're All Set!

Your USB scanner is now fully integrated with CLMS. No camera needed!
Just scan and go! 🚀
