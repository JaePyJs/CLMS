const fs = require('fs');
const path = require('path');

// Define field mappings from camelCase to snake_case
const fieldMappings = {
  'isActive': 'is_active',
  'firstName': 'first_name',
  'lastName': 'last_name',
  'studentId': 'student_id',
  'bookId': 'book_id',
  'userId': 'id',
  'equipmentId': 'equipment_id',
  'maxTimeMinutes': 'max_time_minutes',
  'availableCopies': 'available_copies',
  'totalCopies': 'total_copies',
  'accessionNo': 'accession_no',
  'accessionNumber': 'accession_no',
  'barcodeImage': 'barcode_image',
  'gradeLevel': 'grade_level',
  'gradeCategory': 'grade_category',
  'checkoutDate': 'checkout_date',
  'dueDate': 'due_date',
  'returnDate': 'return_date',
  'fineAmount': 'fine_amount',
  'finePaid': 'fine_paid',
  'overdueDays': 'overdue_days',
  'processedBy': 'processed_by',
  'createdAt': 'created_at',
  'updatedAt': 'updated_at',
  'startTime': 'start_time',
  'endTime': 'end_time',
  'durationMinutes': 'duration_minutes',
  'timeLimitMinutes': 'time_limit_minutes',
  'activityType': 'activity_type',
  'equipmentId': 'equipment_id',
  'checkoutId': 'checkout_id',
  'studentName': 'student_name',
  'googleSynced': 'google_synced',
  'syncAttempts': 'sync_attempts',
  'requiresSupervision': 'requires_supervision',
  'actualDuration': 'actual_duration',
  'plannedEnd': 'planned_end',
  'sessionStart': 'session_start',
  'sessionEnd': 'session_end',
  'publishYear': 'year',
  'specifications': 'description',
  'lastLoginAt': 'last_login_at',
  'fullName': 'full_name',
  'actionUrl': 'action_url',
  'readAt': 'read_at',
  'expiresAt': 'expires_at',
  'metadata': 'metadata',
  'failureCount': 'failure_count',
  'successCount': 'success_count',
  'totalRuns': 'total_runs',
  'lastRunAt': 'last_run_at',
  'nextRunAt': 'next_run_at',
  'averageDurationMs': 'average_duration_ms',
  'recordsProcessed': 'records_processed',
  'triggeredBy': 'triggered_by',
  'errorDetails': 'error_details',
  'errorMessage': 'error_message',
  'executionId': 'execution_id',
  'completedAt': 'completed_at',
  'durationMs': 'duration_ms',
  'startedAt': 'started_at',
  'isEnabled': 'is_enabled',
  'isSecret': 'is_secret'
};

// Define object property mappings (for object literals)
const propertyMappings = {
  ...fieldMappings,
  'email': 'email',
  'username': 'username',
  'password': 'password',
  'role': 'role',
  'status': 'status',
  'type': 'type',
  'name': 'name',
  'location': 'location',
  'description': 'description',
  'notes': 'notes',
  'section': 'section',
  'author': 'author',
  'title': 'title',
  'publisher': 'publisher',
  'category': 'category',
  'subcategory': 'subcategory',
  'isbn': 'isbn',
  'edition': 'edition',
  'pages': 'pages',
  'remarks': 'remarks',
  'sourceOfFund': 'source_of_fund',
  'volume': 'volume',
  'year': 'year',
  'costPrice': 'cost_price',
  'ipAddress': 'ip_address',
  'newValues': 'new_values',
  'oldValues': 'old_values',
  'performedBy': 'performed_by',
  'userAgent': 'user_agent',
  'entityId': 'entity_id',
  'entityType': 'entity_type',
  'barcodeData': 'barcode_data',
  'format': 'format',
  'generatedAt': 'generated_at',
  'generatedBy': 'generated_by'
};

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix property names in object literals (more comprehensive)
  Object.entries(propertyMappings).forEach(([oldName, newName]) => {
    // Fix object property patterns
    const objectPropRegex = new RegExp(`\\b${oldName}:`, 'g');
    if (objectPropRegex.test(content)) {
      content = content.replace(objectPropRegex, `${newName}:`);
      modified = true;
    }
    
    // Fix destructuring patterns
    const destructuringRegex = new RegExp(`\\b\\{[^}]*\\b${oldName}\\b[^}]*\\}`, 'g');
    content = content.replace(destructuringRegex, (match) => {
      return match.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
    });
    
    // Fix property access patterns
    const propertyAccessRegex = new RegExp(`\\.${oldName}\\b`, 'g');
    if (propertyAccessRegex.test(content)) {
      content = content.replace(propertyAccessRegex, `.${newName}`);
      modified = true;
    }
  });
  
  // Fix specific patterns for IDs
  content = content.replace(/\buserId\b/g, 'id');
  content = content.replace(/\bstudentId\b/g, 'student_id');
  content = content.replace(/\bbookId\b/g, 'book_id');
  content = content.replace(/\bequipmentId\b/g, 'equipment_id');
  
  // Fix shorthand property assignments
  Object.entries(propertyMappings).forEach(([oldName, newName]) => {
    const shorthandRegex = new RegExp(`\\b${oldName}\\b(?=\\s*[,}])`, 'g');
    if (shorthandRegex.test(content)) {
      content = content.replace(shorthandRegex, newName);
      modified = true;
    }
  });
  
  // Fix missing required fields for Prisma create operations (simplified)
  content = content.replace(/prisma\.(users|students|books|equipment)\.create\(/g, 'prisma.$1.create({');
  content = content.replace(/data:\s*{/g, 'data: { id: crypto.randomUUID(), updated_at: new Date(), ');
  
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
console.log('Fixing Prisma field names in src/services...');
fixDirectory(path.join(__dirname, 'src', 'services'));

console.log('Fixing Prisma field names in src/tests...');
fixDirectory(path.join(__dirname, 'src', 'tests'));

console.log('Fixing Prisma field names in scripts...');
fixDirectory(path.join(__dirname, 'scripts'));

console.log('Fixing Prisma field names in src/websocket...');
fixDirectory(path.join(__dirname, 'src', 'websocket'));

console.log('Fixing Prisma field names in src/utils...');
fixDirectory(path.join(__dirname, 'src', 'utils'));

console.log('Done!');