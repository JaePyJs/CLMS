# 📊 Barcode Generation Guide

## Overview

The CLMS Barcode Generation System creates **Code128 barcodes** for all active students, making it easy to scan and track library activities using your USB barcode scanner.

---

## ✨ Features

- **Code128 Format**: Industry-standard barcode format compatible with all USB scanners
- **Batch Generation**: Create barcodes for all active students in one click
- **Printable Sheets**: Auto-generated HTML sheets with student names and IDs
- **Compressed Printing**: Toggle between 3 or 4 barcodes per row to save paper
- **Database Integration**: Automatically updates student records with barcode paths
- **Error Tracking**: Detailed reports of successful and failed generations
- **USB Scanner Ready**: Works perfectly with your 2D USB barcode scanner

---

## 🚀 Quick Start

### Option 1: Generate via Web UI (Recommended)

1. **Open CLMS Dashboard**

   - Navigate to **📊 Barcodes** tab (or press Alt+7)

2. **Generate Barcodes**

   - Click **"Generate All"** button
   - Wait for generation to complete (usually < 30 seconds for 55 students)
   - View success count in the summary

3. **Print Barcodes**
   - Click **"Open Sheet"** to view printable barcode sheet
   - Click **"Toggle Compressed Mode"** to switch between 3/4 per row
   - Use your browser's print function (Ctrl+P)
   - Print on standard A4 paper

### Option 2: Generate via Command Line

```powershell
cd Backend
npm run generate:barcodes
```

---

## 📁 File Structure

After generation, you'll have:

```
Backend/
├── barcodes/
│   └── students/
│       ├── 101.png              # Individual barcode images (Code128)
│       ├── 102.png
│       ├── ...
│       ├── index.html           # Printable sheet with all barcodes
│       └── _generation-report.json  # Detailed generation log
```

---

## 🖨️ Printing Guide

### Compressed Mode (Saves Paper)

1. Open the printable sheet: `http://localhost:3001/api/utilities/barcodes-sheet`
2. Click **"Toggle Compressed Mode"** button
3. **Compressed**: 4 barcodes per row (saves ~25% paper)
4. **Normal**: 3 barcodes per row (easier to cut)
5. Print using Ctrl+P
6. Recommended: Use "Fit to page" scaling

### Print Settings

- **Paper Size**: A4
- **Orientation**: Portrait
- **Margins**: 15mm all sides
- **Scale**: Fit to page (or 100%)
- **Background Graphics**: ON (to print borders)

---

## 📊 Barcode Specifications

- **Format**: Code128 (alphanumeric)
- **Data Encoded**: Student ID (e.g., "101", "202A")
- **Image Size**: 200x50 pixels (3x scaling)
- **Bar Height**: 15mm
- **Human-Readable Text**: YES (centered below barcode)
- **File Format**: PNG
- **Background**: White

---

## 🔌 Using with USB Scanner

### Setup

1. Plug in your 2D USB barcode scanner
2. Open CLMS → **📷 Scan** tab
3. Scanner auto-activates (no camera needed)
4. Print and test scan a barcode

### Scanning Process

1. **Print Barcodes** using the printable sheet
2. **Cut Out** individual barcode cards
3. **Scan Barcode** with your USB scanner
4. System instantly looks up the student
5. Perform check-in/check-out or other actions

### Troubleshooting Scanner

If scanner doesn't work:

- Ensure it's in **keyboard wedge mode** (sends keystrokes)
- Try unplugging and replugging the USB
- Check Windows Device Manager for COM port errors
- Make sure cursor is in the scan input field

---

## 🎯 API Endpoints

### Generate Barcodes

```http
POST /api/utilities/generate-barcodes
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalStudents": 55,
    "successCount": 55,
    "errorCount": 0,
    "outputDir": "C:/CLMS/Backend/barcodes/students",
    "results": [...],
    "generatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Generation Report

```http
GET /api/utilities/barcode-generation-report
```

### Get Single Barcode Image

```http
GET /api/utilities/barcode/:studentId
```

Example: `http://localhost:3001/api/utilities/barcode/101`

### Printable Sheet

```http
GET /api/utilities/barcodes-sheet
```

### Regenerate Single Barcode

```http
POST /api/utilities/regenerate-barcode/:studentId
```

### Delete Barcode

```http
DELETE /api/utilities/barcode/:studentId
```

---

## 🛠️ Advanced Usage

### CLI Generation Script

Located at: `Backend/scripts/generate-barcodes-new.ts`

**Run it:**

```powershell
cd Backend
npm run generate:barcodes
```

**Output:**

```
🚀 Starting barcode generation for all active students...

============================================================
📊 BARCODE GENERATION SUMMARY
============================================================
📁 Output Directory: C:/CLMS/Backend/barcodes/students
👥 Total Students: 55
✅ Successful: 55
❌ Errors: 0
🕒 Generated At: 1/15/2024, 10:30:00 AM
============================================================

📄 Files Generated:
  • 55 barcode PNG files
  • 1 generation report JSON file
  • 1 printable HTML sheet (index.html)

🎯 Next Steps:
  1. View barcodes: Open C:/CLMS/Backend/barcodes/students
  2. Print barcodes: Open C:/CLMS/Backend/barcodes/students/index.html
  3. Use compressed mode: Click "Toggle Compressed Mode" before printing
  4. Scan barcodes: Use your USB scanner on the Scan tab
```

### Custom Barcode Generation (Code)

```typescript
import { barcodeService } from "@/services/barcodeService";

// Generate for all students
const summary = await barcodeService.generateBarcodesForAllStudents();

// Generate for one student
const path = await barcodeService.generateBarcodeForStudent("101");

// Check if exists
const exists = barcodeService.barcodeExists("101");

// Get barcode path
const path = barcodeService.getBarcodePath("101");

// Delete barcode
await barcodeService.deleteBarcodeForStudent("101");

// Regenerate barcode
await barcodeService.regenerateBarcodeForStudent("101");
```

---

## 🎨 Customization

### Change Barcode Format

Edit `Backend/src/services/barcodeService.ts`:

```typescript
const png = await bwipjs.toBuffer({
  bcid: "code128", // Try: 'code39', 'ean13', 'qrcode'
  text: studentId,
  scale: 3, // Adjust size (1-5)
  height: 15, // Bar height in mm
  includetext: true, // Show/hide text
  textxalign: "center", // Text alignment
  textsize: 13, // Font size
});
```

### Change Print Layout

Edit `Backend/src/services/barcodeService.ts` → `generatePrintableSheet()`:

```css
/* Normal mode */
.barcode-grid {
  grid-template-columns: repeat(3, 1fr); /* Change to 2 or 4 */
  gap: 15px; /* Adjust spacing */
}

/* Compressed mode */
.barcode-grid.compressed {
  grid-template-columns: repeat(4, 1fr); /* Change to 5 or 6 */
  gap: 8px;
}
```

---

## 📋 Best Practices

1. **Generate Once**: Barcodes are permanent - generate once, print multiple times
2. **Test First**: Print 1-2 barcodes, test scanning before bulk printing
3. **Laminate**: Protect printed barcodes with lamination or clear tape
4. **Label**: Write student name on the back of barcode cards
5. **Backup**: Keep digital copies of barcodes in case cards are lost
6. **Regular Scans**: Use barcodes for daily attendance and equipment tracking

---

## 🔍 Differences: Barcode vs QR Code

| Feature              | Barcode (Code128)       | QR Code                    |
| -------------------- | ----------------------- | -------------------------- |
| **Format**           | 1D linear               | 2D matrix                  |
| **Data Capacity**    | ~100 characters         | ~4,000 characters          |
| **Scanner Type**     | Basic 1D/2D scanner     | Camera or 2D scanner       |
| **Size**             | Compact (horizontal)    | Square                     |
| **Error Correction** | Checksum only           | High (up to 30%)           |
| **Speed**            | Very fast               | Fast                       |
| **Use Case**         | Quick student ID lookup | Full student data encoding |

**Recommendation**: Use **barcodes** for your USB scanner for fastest scanning.

---

## 🆘 Troubleshooting

### Barcodes Won't Generate

**Problem**: Generation fails with errors

**Solutions**:

- Check database connection (MySQL running?)
- Ensure students exist with valid IDs
- Check disk space in `Backend/barcodes/` folder
- Review `Backend/logs/` for error details

### Barcodes Won't Scan

**Problem**: Scanner doesn't read barcodes

**Solutions**:

- Ensure barcode is printed clearly (not pixelated)
- Try increasing print scale to 110-120%
- Check scanner is in keyboard wedge mode
- Clean scanner lens with soft cloth
- Ensure good lighting when scanning
- Try scanning from different angles

### Printable Sheet Not Found

**Problem**: 404 error when opening sheet

**Solutions**:

- Run barcode generation first
- Check `Backend/barcodes/students/index.html` exists
- Restart backend server
- Clear browser cache

---

## 📝 Generation Report Format

**File**: `Backend/barcodes/students/_generation-report.json`

```json
{
  "totalStudents": 55,
  "successCount": 55,
  "errorCount": 0,
  "outputDir": "C:/CLMS/Backend/barcodes/students",
  "results": [
    {
      "studentId": "101",
      "name": "John Doe",
      "barcodePath": "C:/CLMS/Backend/barcodes/students/101.png",
      "barcodeUrl": "/api/utilities/barcode/101",
      "success": true
    }
  ],
  "generatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## 🎉 Success!

You now have a complete barcode system integrated with your CLMS!

**Next Steps:**

1. Generate barcodes for all students
2. Print the barcode sheet
3. Distribute to students
4. Start scanning for attendance/equipment tracking

Happy scanning! 📊✨
