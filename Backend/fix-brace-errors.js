const fs = require('fs');
const path = require('path');

// Fix double brace errors and other specific TypeScript syntax issues
const fixBraceErrors = (filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix double braces in prisma calls
    content = content.replace(/prisma\.\w+\.create\(\{\{/g, (match) => {
      modified = true;
      return match.replace('{{', '{');
    });
    
    content = content.replace(/prisma\.\w+\.update\(\{\{/g, (match) => {
      modified = true;
      return match.replace('{{', '{');
    });
    
    content = content.replace(/prisma\.\w+\.upsert\(\{\{/g, (match) => {
      modified = true;
      return match.replace('{{', '{');
    });
    
    // Fix property assignment errors - specific pattern
    content = content.replace(/\{(\s*)(\w+)(\s+)(\w+)(\s*)\}/g, (match, p1, p2, p3, p4, p5) => {
      if (!match.includes('{{') && !match.includes(':')) {
        modified = true;
        return `{${p1}${p2}:${p3}${p4}${p5}`;
      }
      return match;
    });
    
    // Fix missing comma in logger calls
    content = content.replace(/logger\.(info|error|warn|debug)\("([^"]+)"(\s+)([^,)]+?)(\s*\))/g, (match, level, msg, space, context, end) => {
      // Only fix if context doesn't start with a comma
      if (!context.trim().startsWith(',')) {
        modified = true;
        return `logger.${level}("${msg}",${space}${context}${end}`;
      }
      return match;
    });
    
    // Fix emit/broadcast calls
    content = content.replace(/\.(emit|broadcast)\("([^"]+)"(\s+)([^,)]+?)(\s*\))/g, (match, method, event, space, data, end) => {
      // Only fix if data doesn't start with a comma
      if (!data.trim().startsWith(',')) {
        modified = true;
        return `.${method}("${event}",${space}${data}${end}`;
      }
      return match;
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
    if (fixBraceErrors(fullPath)) {
      fixedCount++;
    }
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});

console.log(`\nFixed ${fixedCount} files with brace errors`);