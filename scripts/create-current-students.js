const fs = require('fs');
const path = require('path');

// Read the Excel data
const excelDataPath = path.join(__dirname, '..', 'SHJCS_Complete_Library_Database_Organized.xlsx');
const XLSX = require('xlsx');

// Read the workbook
const workbook = XLSX.readFile(excelDataPath);
const sheetName = 'Current_Students'; // Use the correct sheet name
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet);

// Transform the data to match our expected format
const currentStudents = jsonData.map((row, index) => {
  return {
    Full_Name: row.Full_Name || '',
    "User id": row["User id"] || '',
    Grade_Level: row.Grade_Level || '',
    School_Level: 'Elementary School', // Default value, will be updated by the fix script
    Index: index + 1
  };
});

// Write the data to a JSON file
const outputPath = path.join(__dirname, '..', 'Current_Students.json');
fs.writeFileSync(outputPath, JSON.stringify(currentStudents, null, 2));

console.log(`Created Current_Students.json with ${currentStudents.length} student records.`);