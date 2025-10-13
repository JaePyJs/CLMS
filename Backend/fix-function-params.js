const fs = require('fs');
const path = require('path');

// Fix function parameter syntax errors with crypto.randomUUID() and new Date()
const fixFunctionParams = (filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix function parameters that include crypto.randomUUID() and new Date() in type definition
    // Pattern: data: { id: crypto.randomUUID(), updated_at: new Date(), 
    content = content.replace(/data:\s*\{\s*id:\s*crypto\.randomUUID\(\),\s*updated_at:\s*new\s+Date\(\),/g, () => {
      modified = true;
      return 'data: {';
    });
    
    // Fix similar patterns in function parameters
    content = content.replace(/data:\s*\{\s*id:\s*crypto\.randomUUID\(\),\s*updated_at:\s*new\s+Date\(\),\s*subscription:\s*string\s*\}/g, () => {
      modified = true;
      return 'data: { subscription: string }';
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
  'src/websocket/eventHandlers.ts'
];

let fixedCount = 0;
filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (fixFunctionParams(fullPath)) {
      fixedCount++;
    }
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});

console.log(`\nFixed ${fixedCount} files with function parameter errors`);