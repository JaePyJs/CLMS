const fs = require('fs');
const path = require('path');

// Read the current students data
const studentsDataPath = path.join(__dirname, '..', 'Current_Students.json');
let studentsData = JSON.parse(fs.readFileSync(studentsDataPath, 'utf8'));

// Function to determine school level based on grade level
function getSchoolLevel(gradeLevel) {
  if (gradeLevel.includes('Grade 12') || gradeLevel.includes('Class of 2023')) {
    return 'Senior High School';
  } else if (gradeLevel.includes('Grade 11') || gradeLevel.includes('Class of 2024')) {
    return 'Senior High School';
  } else if (gradeLevel.includes('Grade 10') || gradeLevel.includes('Class of 2025')) {
    return 'High School (Junior)';
  } else if (gradeLevel.includes('Pre-Nursery') || gradeLevel.includes('Kindergarten')) {
    return 'Elementary School';
  } else if (gradeLevel.includes('Grade 7') || gradeLevel.includes('Grade 8') || gradeLevel.includes('Grade 9')) {
    return 'Junior High School';
  } else if (gradeLevel.includes('Grade 1') || gradeLevel.includes('Grade 2') || 
             gradeLevel.includes('Grade 3') || gradeLevel.includes('Grade 4') || 
             gradeLevel.includes('Grade 5') || gradeLevel.includes('Grade 6')) {
    return 'Elementary School';
  } else {
    return 'Elementary School'; // Default fallback
  }
}

// Update school levels for all students
studentsData.forEach(student => {
  student.School_Level = getSchoolLevel(student.Grade_Level);
});

// Write the updated data back to the file
fs.writeFileSync(studentsDataPath, JSON.stringify(studentsData, null, 2));

console.log('School levels have been updated for all students.');
console.log(`Updated ${studentsData.length} student records.`);

// Print a summary of the updated school levels
const schoolLevelCounts = {};
studentsData.forEach(student => {
  schoolLevelCounts[student.School_Level] = (schoolLevelCounts[student.School_Level] || 0) + 1;
});

console.log('\nSchool Level Distribution:');
Object.entries(schoolLevelCounts).forEach(([level, count]) => {
  console.log(`${level}: ${count} students`);
});