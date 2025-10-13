const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix broken create operations
  content = content.replace(/prisma\.(users|students|books|equipment)\.create\({/g, 'prisma.$1.create({');
  content = content.replace(/data:\s*{\s*id:\s*crypto\.randomUUID\(\),\s*updated_at:\s*new Date\(\),\s*}/g, 'data: {');
  
  // Fix broken property assignments
  content = content.replace(/({[^}]*)\s*(id|updated_at|created_at):\s*([^,}]*),/g, '$1$2: $3,');
  
  // Fix missing required fields in create operations
  content = content.replace(/data:\s*{([^}]*)}/g, (match, dataContent) => {
    // Only add required fields if they're not already present
    if (!dataContent.includes('id:') && !dataContent.includes('updated_at:')) {
      // Check if this is a create operation for a model that needs these fields
      if (match.includes('users') || match.includes('students') || match.includes('books') || match.includes('equipment')) {
        return `data: { id: crypto.randomUUID(), updated_at: new Date(), ${dataContent}}`;
      }
    }
    return match;
  });
  
  // Fix broken property access patterns
  content = content.replace(/\.\s*(id|student_id|book_id|equipment_id|first_name|last_name|is_active|created_at|updated_at)\b/g, '.$1');
  
  // Fix broken object literals with missing property assignments
  content = content.replace(/({\s*)(\w+):\s*([^,}]*)(\s*[,}])/g, '$1$2: $3$4');
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed syntax: ${filePath}`);
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

// Fix specific directories that had syntax errors
console.log('Fixing syntax errors in scripts...');
fixDirectory(path.join(__dirname, 'scripts'));

console.log('Fixing syntax errors in src/services...');
fixDirectory(path.join(__dirname, 'src', 'services'));

console.log('Fixing syntax errors in src/tests...');
fixDirectory(path.join(__dirname, 'src', 'tests'));

console.log('Fixing syntax errors in src/websocket...');
fixDirectory(path.join(__dirname, 'src', 'websocket'));

console.log('Done!');