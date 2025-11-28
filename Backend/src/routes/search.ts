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
      // Perform parallel searches
      const [students, books, equipment] = await Promise.all([
        // Search Students
        prisma.students.findMany({
          where: {
            OR: [
              { first_name: { contains: query } }, // Case insensitive by default in SQLite/Postgres usually, but explicit mode might be needed depending on DB
              { last_name: { contains: query } },
              { student_id: { contains: query } },
              { barcode: { contains: query } },
            ],
          },
          take: 5,
        }),

        // Search Books
        prisma.books.findMany({
          where: {
            OR: [
              { title: { contains: query } },
              { author: { contains: query } },
              { isbn: { contains: query } },
              { accession_no: { contains: query } },
            ],
          },
          take: 5,
        }),

        // Search Equipment
        prisma.equipment.findMany({
          where: {
            OR: [
              { name: { contains: query } },
              { serial_number: { contains: query } },
              { category: { contains: query } },
            ],
          },
          take: 5,
        }),
      ]);

      // Transform results into a unified format
      const results = [
        ...students.map(s => ({
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
        ...books.map(b => ({
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
        ...equipment.map(e => ({
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
