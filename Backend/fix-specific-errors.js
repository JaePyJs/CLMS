const fs = require('fs');
const path = require('path');

// Fix specific TypeScript errors
const fixSpecificFile = (filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix property assignment errors (TS1136) - specific patterns
    content = content.replace(/\{(\s*)(\w+)(\s+)(\w+)(\s*)\}/g, (match, p1, p2, p3, p4, p5) => {
      modified = true;
      return `{${p1}${p2}:${p3}${p4}${p5}`;
    });
    
    // Fix logger.info patterns with missing comma
    content = content.replace(/logger\.(info|error|warn|debug)\("([^"]+)"(\s+)([^,)]+)(\s*\))/g, (match, level, msg, space, context, end) => {
      modified = true;
      return `logger.${level}("${msg}",${space}${context}${end}`;
    });
    
    // Fix emit/broadcast patterns
    content = content.replace(/\.(emit|broadcast)\("([^"]+)"(\s+)([^,)]+)(\s*\))/g, (match, method, event, space, data, end) => {
      modified = true;
      return `.${method}("${event}",${space}${data}${end}`;
    });
    
    // Fix Prisma where/data patterns
    content = content.replace(/(where|data):\s*\{(\s*)(\w+)(\s+)(\w+)(\s*)\}/g, (match, key, p1, p2, p3, p4, p5) => {
      modified = true;
      return `${key}: {${p1}${p2}:${p3}${p4}${p5}`;
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
  }
  return false;
};

// List of specific files with errors from the TypeScript output
const filesToFix = [
  'scripts/create-librarian.ts',
  'scripts/initialize-system.ts',
  'scripts/manage-admins.ts',
  'scripts/seed.ts',
  'src/services/authService.ts',
  'src/services/bookService.ts',
  'src/services/equipmentService.ts',
  'src/services/importService.ts',
  'src/services/shjcsImportService.ts',
  'src/services/studentService.ts',
  'src/services/user.service.ts',
  'src/tests/analytics/globalSetup.ts',
  'src/tests/analytics/setup.ts',
  'src/tests/integration/globalSetup.ts',
  'src/tests/websocket/globalSetup.ts',
  'src/websocket/eventHandlers.ts'
];

let fixedCount = 0;
filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (fixSpecificFile(fullPath)) {
      fixedCount++;
    }
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});

console.log(`\nFixed ${fixedCount} specific TypeScript files`);