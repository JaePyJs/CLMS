const fs = require('fs');
const path = require('path');

// Fix the remaining specific TypeScript syntax errors
const fixFinalErrors = (filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix function parameter syntax errors
    // Pattern: function createBook(data: { id: crypto.randomUUID(), updated_at: new Date(), 
    content = content.replace(/function\s+(\w+)\(data:\s*\{\s*id:\s*crypto\.randomUUID\(\),\s*updated_at:\s*new\s+Date\(\),/g, (match, funcName) => {
      modified = true;
      return `function ${funcName}(data: {`;
    });
    
    // Fix import statement syntax error
    // Pattern: import { Server: as: HttpsServer } from 'https';
    content = content.replace(/import\s*\{\s*Server:\s*as:\s*HttpsServer\s*\}/g, () => {
      modified = true;
      return 'import { Server as HttpsServer }';
    });
    
    // Fix logger calls with missing commas
    content = content.replace(/logger\.(info|error|warn|debug)\("([^"]+)"(\s+)([^,)]+?)(\s*\))/g, (match, level, msg, space, context, end) => {
      if (!context.trim().startsWith(',') && !context.includes('crypto.randomUUID()')) {
        modified = true;
        return `logger.${level}("${msg}",${space}${context}${end}`;
      }
      return match;
    });
    
    // Fix emit calls with missing commas
    content = content.replace(/\.(emit|broadcast)\("([^"]+)"(\s+)([^,)]+?)(\s*\))/g, (match, method, event, space, data, end) => {
      if (!data.trim().startsWith(',') && !data.includes('crypto.randomUUID()')) {
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

// List of remaining files with errors
const filesToFix = [
  'src/services/bookService.ts',
  'src/services/equipmentService.ts',
  'src/services/studentService.ts',
  'src/websocket/eventHandlers.ts',
  'src/websocket/websocketServer.ts'
];

let fixedCount = 0;
filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (fixFinalErrors(fullPath)) {
      fixedCount++;
    }
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});

console.log(`\nFixed ${fixedCount} files with final syntax errors`);