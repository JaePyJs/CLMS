const fs = require('fs');
const path = require('path');

// Fix all TypeScript syntax errors in the codebase
const fixFile = (filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix property assignment errors (TS1136)
    // Replace patterns like: { password hashedPassword } with { password: hashedPassword }
    content = content.replace(/\{(\s*)(\w+)(\s+)(\w+)(\s*)\}/g, '{$1$2:$3$4$5}');
    content = content.replace(/\{(\s*)(\w+)(\s+)(\w+)(\s+)(\w+)(\s*)\}/g, '{$1$2:$3$4:$5$6$7}');
    
    // Fix missing semicolon errors (TS1005)
    // Fix patterns like: logger.info("message" context) with logger.info("message", context)
    content = content.replace(/logger\.info\("([^"]+)"(\s+)([^)]+)\)/g, 'logger.info("$1",$3)');
    content = content.replace(/logger\.error\("([^"]+)"(\s+)([^)]+)\)/g, 'logger.error("$1",$3)');
    content = content.replace(/logger\.warn\("([^"]+)"(\s+)([^)]+)\)/g, 'logger.warn("$1",$3)');
    content = content.replace(/logger\.debug\("([^"]+)"(\s+)([^)]+)\)/g, 'logger.debug("$1",$3)');
    
    // Fix WebSocket event handler patterns
    content = content.replace(/emit\("([^"]+)"(\s+)([^)]+)\)/g, 'emit("$1",$3)');
    content = content.replace(/broadcast\("([^"]+)"(\s+)([^)]+)\)/g, 'broadcast("$1",$3)');
    
    // Fix Prisma query patterns
    content = content.replace(/where:\s*\{(\s*)(\w+)(\s+)(\w+)(\s*)\}/g, 'where: {$1$2:$3$4$5}');
    content = content.replace(/data:\s*\{(\s*)(\w+)(\s+)(\w+)(\s*)\}/g, 'data: {$1$2:$3$4$5}');
    
    if (modified || content !== fs.readFileSync(filePath, 'utf8')) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
  }
  return false;
};

// Fix all TypeScript files
const directories = [
  'scripts',
  'src/services',
  'src/tests',
  'src/websocket'
];

let fixedCount = 0;
directories.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    const files = fs.readdirSync(fullPath);
    files.forEach(file => {
      if (file.endsWith('.ts')) {
        if (fixFile(path.join(fullPath, file))) {
          fixedCount++;
        }
      }
    });
  }
});

console.log(`\nFixed ${fixedCount} TypeScript files`);