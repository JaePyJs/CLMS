import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Type definitions for raw query results
interface StudentSearchResult {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: number | null;
  section: string | null;
  is_active: boolean;
}

interface BookSearchResult {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  accession_no: string | null;
  location: string | null;
  available_copies: number;
}

interface EquipmentSearchResult {
  id: string;
  name: string;
  serial_number: string | null;
  category: string | null;
  status: string;
}

interface RoomSearchResult {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface SettingSearchResult {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: string;
}

// GET /api/search
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const query = (req.query.q as string)?.trim();
    const typeFilter = (req.query.type as string)?.trim()?.toLowerCase();

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: [],
      });
    }

    try {
      // Use raw SQL with LOWER() for true case-insensitive search in SQLite
      const searchPattern = `%${query.toLowerCase()}%`;

      // Initialize empty result arrays
      let students: StudentSearchResult[] = [];
      let books: BookSearchResult[] = [];
      let equipment: EquipmentSearchResult[] = [];
      let rooms: RoomSearchResult[] = [];
      let settings: SettingSearchResult[] = [];

      // Search based on type filter or search all if no filter
      const searchAll = !typeFilter;

      // Search Students using raw SQL for case-insensitive matching
      if (searchAll || typeFilter === 'student' || typeFilter === 'students') {
        students = await prisma.$queryRaw<StudentSearchResult[]>`
          SELECT id, student_id, first_name, last_name, grade_level, section, is_active
          FROM students
          WHERE LOWER(first_name) LIKE ${searchPattern}
             OR LOWER(last_name) LIKE ${searchPattern}
             OR LOWER(student_id) LIKE ${searchPattern}
             OR LOWER(COALESCE(barcode, '')) LIKE ${searchPattern}
          LIMIT 10
        `;
      }

      // Search Books using raw SQL
      if (searchAll || typeFilter === 'book' || typeFilter === 'books') {
        books = await prisma.$queryRaw<BookSearchResult[]>`
          SELECT id, title, author, isbn, accession_no, location, available_copies
          FROM books
          WHERE LOWER(title) LIKE ${searchPattern}
             OR LOWER(COALESCE(author, '')) LIKE ${searchPattern}
             OR LOWER(COALESCE(isbn, '')) LIKE ${searchPattern}
             OR LOWER(COALESCE(accession_no, '')) LIKE ${searchPattern}
          LIMIT 10
        `;
      }

      // Search Equipment using raw SQL
      if (searchAll || typeFilter === 'equipment') {
        equipment = await prisma.$queryRaw<EquipmentSearchResult[]>`
          SELECT id, name, serial_number, category, status
          FROM equipment
          WHERE LOWER(name) LIKE ${searchPattern}
             OR LOWER(COALESCE(serial_number, '')) LIKE ${searchPattern}
             OR LOWER(COALESCE(category, '')) LIKE ${searchPattern}
          LIMIT 10
        `;
      }

      // Search Library Sections (Rooms) using raw SQL
      if (
        searchAll ||
        typeFilter === 'room' ||
        typeFilter === 'rooms' ||
        typeFilter === 'section' ||
        typeFilter === 'sections'
      ) {
        rooms = await prisma.$queryRaw<RoomSearchResult[]>`
          SELECT id, code, name, description, is_active
          FROM library_sections
          WHERE LOWER(name) LIKE ${searchPattern}
             OR LOWER(code) LIKE ${searchPattern}
             OR LOWER(COALESCE(description, '')) LIKE ${searchPattern}
          LIMIT 10
        `;
      }

      // Search System Settings using raw SQL
      if (searchAll || typeFilter === 'setting' || typeFilter === 'settings') {
        settings = await prisma.$queryRaw<SettingSearchResult[]>`
          SELECT id, key, value, description, category
          FROM system_settings
          WHERE LOWER(key) LIKE ${searchPattern}
             OR LOWER(COALESCE(description, '')) LIKE ${searchPattern}
             OR LOWER(COALESCE(category, '')) LIKE ${searchPattern}
          LIMIT 10
        `;
      }

      // Transform results into a unified format
      const results = [
        ...students.slice(0, 5).map(s => ({
          type: 'student',
          id: s.id,
          title: `${s.first_name} ${s.last_name}`,
          subtitle: s.student_id,
          status: s.is_active ? 'Active' : 'Inactive',
          metadata: {
            grade: s.grade_level,
            section: s.section,
          },
        })),
        ...books.slice(0, 5).map(b => ({
          type: 'book',
          id: b.id,
          title: b.title,
          subtitle: b.author || 'Unknown Author',
          status: b.available_copies > 0 ? 'Available' : 'Out of Stock',
          metadata: {
            isbn: b.isbn,
            location: b.location,
          },
        })),
        ...equipment.slice(0, 5).map(e => ({
          type: 'equipment',
          id: e.id,
          title: e.name,
          subtitle: e.category || 'Equipment',
          status: e.status,
          metadata: {
            serial: e.serial_number,
          },
        })),
        ...rooms.slice(0, 5).map(r => ({
          type: 'room',
          id: r.id,
          title: r.name,
          subtitle: r.code,
          status: r.is_active ? 'Active' : 'Inactive',
          metadata: {
            description: r.description,
          },
        })),
        ...settings.slice(0, 5).map(s => ({
          type: 'setting',
          id: s.id,
          title: s.key,
          subtitle: s.category,
          status: 'Configured',
          metadata: {
            description: s.description,
            value:
              s.value?.length > 50 ? `${s.value.substring(0, 50)}...` : s.value,
          },
        })),
      ];

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      logger.error('Search error', { error, query });
      throw error;
    }
  }),
);

export default router;
