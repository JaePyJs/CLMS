# 📱 QR Code Generator for CLMS

## ✨ What This Does

This system generates unique QR codes for every student in your database and provides multiple ways to use them:

1. **Individual QR Code Images** - PNG files for each student
2. **Printable QR Code Sheet** - HTML page with all QR codes for printing
3. **Student ID Cards** - Professional ID cards with QR codes
4. **Google Sheets Integration** - Syncs QR code info to your spreadsheet

## 🚀 Quick Start

### Step 1: Generate QR Codes

```bash
cd Backend
npm run generate:qr
```

This will:

- ✅ Generate QR codes for all active students
- ✅ Save them as PNG images (300x300px)
- ✅ Update database with QR code paths
- ✅ Create a printable HTML sheet
- ✅ Generate a detailed report

**Output Location:** `Backend/qr-codes/students/`

### Step 2: View QR Codes

Open the generated HTML file in your browser:

```
Backend/qr-codes/students/index.html
```

This shows all QR codes in a nice grid layout with:

- Student ID
- Full name
- Grade level
- Printable format

### Step 3: Sync to Google Sheets (Optional)

```bash
npm run sync:qr
```

This will:

- ✅ Create "Student QR Codes" tab in Google Sheets
- ✅ Upload all QR code information
- ✅ Generate professional ID cards

## 📂 What Gets Generated

```
Backend/qr-codes/
├── students/
│   ├── 20250165.png          # Individual QR codes
│   ├── 20250171.png
│   ├── ...
│   ├── index.html             # Printable QR code sheet
│   └── _generation-report.json # Generation log
└── student-id-cards.html      # Professional ID cards
```

## 🎯 How to Use the QR Codes

### For Students:

1. **Print QR Code Stickers**

   - Open `index.html`
   - Print on label paper
   - Cut and give to students

2. **Create ID Cards**

   - Open `student-id-cards.html`
   - Print on card stock
   - Laminate for durability

3. **Digital Use**
   - Students can save their QR code on their phone
   - Display on screen for scanning

### For Scanning:

1. Open CLMS Scan Workspace
2. Activate USB Scanner
3. Scan student's QR code
4. System automatically recognizes the student
5. Select activity (Computer, Books, etc.)
6. Done! ✅

## 📋 QR Code Format

Each QR code contains the **Student ID** (e.g., `20250165`)

You can customize what data goes in the QR code by editing `generate-qr-codes.ts`:

```typescript
// Simple format (current)
const qrData = student.studentId;

// OR include more data
const qrData = JSON.stringify({
  id: student.studentId,
  name: `${student.firstName} ${student.lastName}`,
  grade: student.gradeLevel,
  type: "student",
});
```

## 🎨 Customization Options

### QR Code Size

In `generate-qr-codes.ts`:

```typescript
await QRCode.toFile(filePath, qrData, {
  width: 300, // Change size (100-1000)
  margin: 2, // White border size
  // ...
});
```

### QR Code Colors

```typescript
color: {
  dark: '#000000',   // QR code color
  light: '#FFFFFF'   // Background color
}
```

### Error Correction Level

```typescript
errorCorrectionLevel: "H"; // L, M, Q, H (higher = more resilient)
```

## 📊 Google Sheets Integration

The sync creates a new tab with:

| Student ID | Full Name | Grade    | Section | Status | QR Generated | Path           | URL         |
| ---------- | --------- | -------- | ------- | ------ | ------------ | -------------- | ----------- |
| 20250165   | John Doe  | Grade 10 | A       | Active | Yes          | path/to/qr.png | file:///... |

This lets you:

- Track which students have QR codes
- Share QR code locations
- Monitor generation status

## 🖨️ Printing Guide

### Option 1: QR Code Sheet

1. Open `index.html` in Chrome/Edge
2. Click "🖨️ Print QR Codes" button
3. Settings:
   - Paper: A4
   - Margins: Normal
   - Background graphics: ON
4. Print!

### Option 2: ID Cards

1. Open `student-id-cards.html`
2. Print on thick card stock (200-250gsm)
3. Cut along borders
4. Laminate for durability

### Option 3: Sticker Labels

1. Use Avery label templates
2. Print `index.html` on sticker sheets
3. Recommended: Avery 5160 (30 labels per sheet)

## 🔧 Troubleshooting

### QR Codes Not Generated?

```bash
# Check if students exist in database
cd Backend
npm run db:studio

# Verify students table has data
```

### Can't See Images in HTML?

- Make sure you're opening the HTML file from the same folder
- Images are relative paths: `./20250165.png`

### Google Sheets Not Syncing?

- Check `GOOGLE_SHEET_ID` in `.env`
- Verify `google-credentials.json` exists
- Ensure service account has write access

### Need to Regenerate?

```bash
# Delete old QR codes
rm -rf Backend/qr-codes/students/*.png

# Generate fresh ones
npm run generate:qr
```

## 📱 Testing Your QR Codes

### Method 1: Phone Camera

1. Open your phone camera
2. Point at QR code
3. Tap the notification
4. Should show the Student ID

### Method 2: Online QR Reader

- https://webqr.com/
- Upload or scan QR code
- Verify it shows correct Student ID

### Method 3: CLMS Scanner

1. Open Scan Workspace
2. Activate USB scanner
3. Scan the QR code
4. Should recognize student

## 🎓 Best Practices

1. **Generate Once, Use Forever**

   - QR codes don't change
   - Regenerate only if student IDs change

2. **Backup QR Codes**

   - Keep `qr-codes` folder backed up
   - Include in your backup routine

3. **Print Quality**

   - Use high-quality printer
   - Minimum 300 DPI
   - Clear contrast (black on white)

4. **Size Matters**

   - Minimum 2cm x 2cm for reliable scanning
   - Larger = easier to scan

5. **Protect from Damage**
   - Laminate ID cards
   - Use waterproof stickers
   - Store digital copies

## 📈 Statistics

After running `npm run generate:qr`, check:

```
Backend/qr-codes/students/_generation-report.json
```

Contains:

- Total students processed
- Success/failure count
- Detailed results per student
- Generation timestamp

## 🔄 Updating QR Codes

### When to Regenerate:

- ✅ New students added
- ✅ Student IDs changed
- ✅ QR code format changed
- ❌ Don't regenerate for grade changes (ID stays same)

### How to Update:

```bash
# Import new students first
npm run import:data

# Then generate QR codes
npm run generate:qr

# Sync to Google Sheets
npm run sync:qr
```

## 🆘 Need Help?

### Common Issues:

**"No students found"**

- Run `npm run import:data` first
- Check database connection

**"Permission denied"**

- Run terminal as administrator
- Check folder permissions

**"Module not found"**

```bash
npm install qrcode @types/qrcode
```

**"Google Sheets error"**

- Verify credentials file exists
- Check service account permissions
- Confirm sheet ID is correct

## 📞 Support

For issues or questions:

1. Check the generation report
2. Review error messages
3. Verify environment variables
4. Test with sample data

---

## 🎉 Success Checklist

- [✅] QR codes generated for all students
- [✅] HTML printable sheet created
- [✅] ID cards template ready
- [✅] Database updated with paths
- [✅] Google Sheets synced (optional)
- [✅] Test scans working
- [✅] Print quality verified

**You're all set! Your students now have scannable QR codes! 🚀**
