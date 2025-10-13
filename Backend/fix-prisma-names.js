const fs = require('fs');
const path = require('path');

// Define the mappings from old (camelCase) to new (snake_case) names
const modelMappings = {
  'user': 'users',
  'student': 'students',
  'book': 'books',
  'bookCheckout': 'book_checkouts',
  'equipmentSession': 'equipment_sessions',
  'studentActivity': 'student_activities',
  'activity': 'student_activities',
  'automationJob': 'automation_jobs',
  'automationLog': 'automation_logs',
  'barcodeHistory': 'barcode_history',
  'auditLog': 'audit_logs',
  'systemConfig': 'system_config',
  'notification': 'notifications'
};

// Define the mappings for enum types
const enumMappings = {
  'GradeCategory': 'students_grade_category',
  'ActivityType': 'student_activities_activity_type',
  'ActivityStatus': 'student_activities_status',
  'CheckoutStatus': 'book_checkouts_status',
  'EquipmentType': 'equipment_type',
  'EquipmentStatus': 'equipment_status',
  'NotificationType': 'notifications_type',
  'NotificationPriority': 'notifications_priority',
  'JobType': 'automation_jobs_type',
  'JobStatus': 'automation_jobs_status'
};

// Define field mappings
const fieldMappings = {
  'equipmentId': 'equipment_id',
  'maxTimeMinutes': 'max_time_minutes',
  'availableCopies': 'available_copies',
  'studentId': 'student_id',
  'bookId': 'book_id',
  'userId': 'id'
};

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix model names
  Object.entries(modelMappings).forEach(([oldName, newName]) => {
    const regex = new RegExp(`\\bprisma\\.${oldName}\\b`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `prisma.${newName}`);
      modified = true;
    }
  });
  
  // Fix enum imports
  Object.entries(enumMappings).forEach(([oldName, newName]) => {
    const importRegex = new RegExp(`\\b${oldName}\\b`, 'g');
    if (importRegex.test(content)) {
      content = content.replace(importRegex, newName);
      modified = true;
    }
  });
  
  // Fix field names in object literals
  Object.entries(fieldMappings).forEach(([oldName, newName]) => {
    const fieldRegex = new RegExp(`\\b${oldName}:`, 'g');
    if (fieldRegex.test(content)) {
      content = content.replace(fieldRegex, `${newName}:`);
      modified = true;
    }
  });
  
  // Fix specific Prisma type names
  content = content.replace(/\bStudentWhereInput\b/g, 'studentsWhereInput');
  content = content.replace(/\bActivityWhereInput\b/g, 'student_activitiesWhereInput');
  content = content.replace(/\bAutomationJobUpdateManyMutationInput\b/g, 'automation_jobsUpdateManyMutationInput');
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

function fixDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fixDirectory(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      fixFile(filePath);
    }
  });
}

// Fix specific directories
console.log('Fixing Prisma names in src/services...');
fixDirectory(path.join(__dirname, 'src', 'services'));

console.log('Fixing Prisma names in src/tests...');
fixDirectory(path.join(__dirname, 'src', 'tests'));

console.log('Fixing Prisma names in scripts...');
fixDirectory(path.join(__dirname, 'scripts'));

console.log('Fixing Prisma names in src/websocket...');
fixDirectory(path.join(__dirname, 'src', 'websocket'));

console.log('Fixing Prisma names in src/utils...');
fixDirectory(path.join(__dirname, 'src', 'utils'));

console.log('Done!');