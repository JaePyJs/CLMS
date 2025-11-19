import * as fs from 'fs'
import * as path from 'path'

function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      out.push(current); current = ''
    } else {
      current += ch
    }
  }
  out.push(current)
  return out
}

function esc(v: string | null | undefined): string {
  if (v == null) return 'NULL'
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''").trim()}'`
}

function cut(v: string | null | undefined, max: number): string | null {
  if (v == null) return null
  const s = String(v)
  return s.length > max ? s.slice(0, max) : s
}

function normalizeGradeLevel(v: string): number {
  const s = String(v).toUpperCase().trim()
  const m: Record<string, number> = {
    'PRE NURSERY': 0,
    'NURSERY': 0,
    'KINDER': 0,
    'GRADE 1': 1,
    'GRADE 2': 2,
    'GRADE 3': 3,
    'GRADE 4': 4,
    'GRADE 5': 5,
    'GRADE 6': 6,
    'GRADE 7': 7,
    'GRADE 8': 8,
    'GRADE 9': 9,
    'GRADE 10': 10,
    'GRADE 11': 11,
    'GRADE 12': 12,
    '2025-2026': 0,
  }
  return m[s] ?? 0
}

function makeStudentsSQL(csvText: string): string {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0)
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
  const iUserId = idx('User ID')
  const iSurname = idx('Surname')
  const iFirst = idx('First Name')
  const iGrade = idx('Grade Level')
  const iSection = idx('Section')
  const iDesignation = idx('Designation')
  let sql = ''
  for (let r = 1; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r])
    const userId = (cols[iUserId] || '').trim()
    const lastName = (cols[iSurname] || '').trim()
    const firstName = (cols[iFirst] || '').trim()
    const grade = (cols[iGrade] || '').trim()
    const section = (cols[iSection] || '').trim()
    const designation = (cols[iDesignation] || '').trim()
    if (!userId || !firstName || !lastName) continue
    const barcode = userId
    const gradeLevel = normalizeGradeLevel(grade)
    sql += `INSERT INTO students (id, student_id, first_name, last_name, grade_level, grade_category, section, email, barcode, is_active, created_at, updated_at) VALUES (REPLACE(UUID(),'-',''), ${esc(userId)}, ${esc(firstName)}, ${esc(lastName)}, ${gradeLevel}, ${esc(designation)}, ${esc(section)}, NULL, ${esc(barcode)}, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name), grade_level=VALUES(grade_level), grade_category=VALUES(grade_category), section=VALUES(section), barcode=VALUES(barcode), is_active=VALUES(is_active), updated_at=NOW();\n`
  }
  return sql
}

function makeBooksSQL(csvText: string): string {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0)
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
  const iBarcode = idx('Barcode')
  const iTitle = idx('Title')
  const iAuthor = idx('Author')
  const iYear = idx('Year')
  const iISBN = idx('ISBN')
  const iPublisher = idx('Publisher')
  const iCollection = idx('Collection Code')
  let sql = ''
  for (let r = 1; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r])
    const barcode = (cols[iBarcode] || '').trim()
    const title = (cols[iTitle] || '').trim()
    const author = cut((cols[iAuthor] || '').trim(), 180) || ''
    const yearStr = (cols[iYear] || '').trim()
    const isbn = (cols[iISBN] || '').trim()
    const publisher = (cols[iPublisher] || '').trim()
    const category = (cols[iCollection] || '').trim()
    if (!barcode || !title || !author || !category) continue
    let year: number | null = null
    if (yearStr) {
      const n = parseInt(yearStr.replace(/[^0-9]/g, ''))
      year = Number.isFinite(n) ? n : null
    }
    sql += `INSERT INTO books (id, accession_no, title, author, isbn, publisher, category, subcategory, location, available_copies, total_copies, cost_price, edition, pages, remarks, source_of_fund, volume, year, is_active, created_at, updated_at) VALUES (REPLACE(UUID(),'-',''), ${esc(barcode)}, ${esc(title)}, ${esc(author)}, ${esc(isbn || null)}, ${esc(publisher || null)}, ${esc(category)}, NULL, NULL, 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, ${year == null ? 'NULL' : year}, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE title=VALUES(title), author=VALUES(author), isbn=VALUES(isbn), publisher=VALUES(publisher), category=VALUES(category), available_copies=VALUES(available_copies), total_copies=VALUES(total_copies), year=VALUES(year), is_active=VALUES(is_active), updated_at=NOW();\n`
  }
  return sql
}

function main() {
  const root = path.resolve(process.cwd())
  const studentsCsv = fs.readFileSync(path.resolve(root, 'csv', 'SHJCS SCANLOGS - SHJCS USERS.csv'), 'utf-8')
  const booksCsv = fs.readFileSync(path.resolve(root, 'csv', 'SHJCS Bibliography - BOOK COLLECTIONS.csv'), 'utf-8')
  const sql = makeStudentsSQL(studentsCsv) + '\n' + makeBooksSQL(booksCsv)
  const outPath = path.resolve(root, 'Backend', 'scripts', 'seed_data.sql')
  fs.writeFileSync(outPath, sql, 'utf-8')
  console.log('Wrote SQL to', outPath)
}

main()