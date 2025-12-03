import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/search
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const query = (req.query.q as string)?.trim();

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: [],
      });
    }

    try {
      // For case-insensitive search in SQLite, we need to use raw SQL with LOWER()
      // or search for both the lowercase and original case versions
      const searchLower = query.toLowerCase();
      const searchOriginal = query;

      // Perform parallel searches with both case variants for SQLite compatibility
      const [students, books, equipment] = await Promise.all([
        // Search Students - use OR to match either lowercase or original
        prisma.students.findMany({
          where: {
            OR: [
              { first_name: { contains: searchLower } },
              { first_name: { contains: searchOriginal } },
              { last_name: { contains: searchLower } },
              { last_name: { contains: searchOriginal } },
              { student_id: { contains: searchLower } },
              { student_id: { contains: searchOriginal } },
              { barcode: { contains: searchLower } },
              { barcode: { contains: searchOriginal } },
            ],
          },
          take: 10,
        }),

        // Search Books
        prisma.books.findMany({
          where: {
            OR: [
              { title: { contains: searchLower } },
              { title: { contains: searchOriginal } },
              { author: { contains: searchLower } },
              { author: { contains: searchOriginal } },
              { isbn: { contains: searchLower } },
              { isbn: { contains: searchOriginal } },
              { accession_no: { contains: searchLower } },
              { accession_no: { contains: searchOriginal } },
            ],
          },
          take: 10,
        }),

        // Search Equipment
        prisma.equipment.findMany({
          where: {
            OR: [
              { name: { contains: searchLower } },
              { name: { contains: searchOriginal } },
              { serial_number: { contains: searchLower } },
              { serial_number: { contains: searchOriginal } },
              { category: { contains: searchLower } },
              { category: { contains: searchOriginal } },
            ],
          },
          take: 10,
        }),
      ]);

      // Deduplicate results (in case both lowercase and original matched the same record)
      const uniqueStudents = students
        .filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx)
        .slice(0, 5);
      const uniqueBooks = books
        .filter((b, idx, arr) => arr.findIndex(x => x.id === b.id) === idx)
        .slice(0, 5);
      const uniqueEquipment = equipment
        .filter((e, idx, arr) => arr.findIndex(x => x.id === e.id) === idx)
        .slice(0, 5);

      // Transform results into a unified format (using deduplicated arrays)
      const results = [
        ...uniqueStudents.map(s => ({
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
        ...uniqueBooks.map(b => ({
          type: 'book',
          id: b.id,
          title: b.title,
          subtitle: b.author,
          status: b.available_copies > 0 ? 'Available' : 'Out of Stock',
          metadata: {
            isbn: b.isbn,
            location: b.location,
          },
        })),
        ...uniqueEquipment.map(e => ({
          type: 'equipment',
          id: e.id,
          title: e.name,
          subtitle: e.category || 'Equipment',
          status: e.status,
          metadata: {
            serial: e.serial_number,
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
