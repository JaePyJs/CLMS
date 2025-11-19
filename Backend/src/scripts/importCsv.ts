import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), 'Backend', '.env') })
if (!process.env.DATABASE_URL || !/mysql:\/\//.test(String(process.env.DATABASE_URL))) {
  process.env.DATABASE_URL = 'mysql://clms_user:change-me-app@localhost:3308/clms_database'
}
const prisma = new PrismaClient()

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

async function importStudents(csvPath: string) {
  const text = fs.readFileSync(csvPath, 'utf-8')
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length <= 1) return
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
  const iUserId = idx('User ID')
  const iSurname = idx('Surname')
  const iFirst = idx('First Name')
  const iGrade = idx('Grade Level')
  const iSection = idx('Section')
  const iDesignation = idx('Designation')
  const result = { imported: 0, errors: 0 }
  for (let r = 1; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r])
    const userId = (cols[iUserId] || '').trim()
    const lastName = (cols[iSurname] || '').trim()
    const firstName = (cols[iFirst] || '').trim()
    const grade = (cols[iGrade] || '').trim()
    const section = (cols[iSection] || '').trim()
    const designation = (cols[iDesignation] || '').trim()
    if (!userId || !firstName || !lastName) { result.errors++; continue }
    let barcode = userId
    const data = {
      student_id: userId,
      first_name: firstName,
      last_name: lastName,
      grade_level: normalizeGradeLevel(grade),
      section: section || null,
      grade_category: designation ? designation.toUpperCase() : null,
      email: null as string | null,
      barcode,
      is_active: true,
    }
    try {
      const existing = await prisma.students.findUnique({ where: { student_id: data.student_id } })
      if (existing) {
        await prisma.students.update({ where: { id: (existing as any).id }, data })
      } else {
        await prisma.students.create({ data })
      }
      result.imported++
    } catch (e) { result.errors++; console.error('Student row error:', (e as any)?.message) }
  }
  return result
}

async function importBooks(csvPath: string) {
  const text = fs.readFileSync(csvPath, 'utf-8')
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length <= 1) return
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
  const iBarcode = idx('Barcode')
  const iTitle = idx('Title')
  const iAuthor = idx('Author')
  const iYear = idx('Year')
  const iISBN = idx('ISBN')
  const iPublisher = idx('Publisher')
  const iCollection = idx('Collection Code')
  const result = { imported: 0, errors: 0 }
  for (let r = 1; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r])
    const accession_no = (cols[iBarcode] || '').trim()
    const title = (cols[iTitle] || '').trim()
    const author = (cols[iAuthor] || '').trim()
    const yearStr = (cols[iYear] || '').trim()
    const isbn = (cols[iISBN] || '').trim()
    const publisher = (cols[iPublisher] || '').trim()
    const category = (cols[iCollection] || '').trim()
    if (!accession_no || !title || !author || !category) { result.errors++; continue }
    const year = yearStr ? parseInt(yearStr) : null
    const data = {
      accession_no,
      title,
      author,
      isbn: isbn || null,
      publisher: publisher || null,
      category,
      subcategory: null as string | null,
      location: null as string | null,
      available_copies: 1,
      total_copies: 1,
      cost_price: null as number | null,
      edition: null as string | null,
      pages: null as string | null,
      remarks: null as string | null,
      source_of_fund: null as string | null,
      volume: null as string | null,
      year,
      is_active: true,
    }
    try {
      const existing = await prisma.books.findUnique({ where: { accession_no } })
      if (existing) {
        await prisma.books.update({ where: { id: (existing as any).id }, data })
      } else {
        await prisma.books.create({ data })
      }
      result.imported++
    } catch (e) { result.errors++; console.error('Book row error:', (e as any)?.message) }
  }
  return result
}

async function main() {
  const root = path.resolve(process.cwd())
  const studentsCsv = path.resolve(root, 'csv', 'SHJCS SCANLOGS - SHJCS USERS.csv')
  const booksCsv = path.resolve(root, 'csv', 'SHJCS Bibliography - BOOK COLLECTIONS.csv')
  console.log('Importing students from', studentsCsv)
  const s = await importStudents(studentsCsv)
  console.log('Students:', s)
  console.log('Importing books from', booksCsv)
  const b = await importBooks(booksCsv)
  console.log('Books:', b)
}

main().catch(err => { console.error(err); process.exit(1) }).finally(async () => { await prisma.$disconnect() })