/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { BookService } from '../services/bookService';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/books
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get books request', {
      query: req.query,
      userId: (req as any).user?.id,
    });

    try {
      const result = await BookService.listBooks(req.query as any);

      res.json({
        success: true,
        data: result.books,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      logger.error('Error retrieving books', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/v1/books/search
router.get(
  '/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Advanced book search request', {
      query: req.query,
      userId: (req as any).user?.id,
    });

    try {
      const query = (req.query.q as string) || (req.query.search as string);
      const filters = {
        category: req.query.category as string,
        author: req.query.author as string,
        isbn: req.query.isbn as string,
        available:
          req.query.available === 'true'
            ? true
            : req.query.available === 'false'
              ? false
              : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      };

      const result = await BookService.searchBooks(query, filters);

      res.json({
        success: true,
        data: result.books,
        total: result.total,
      });
    } catch (error) {
      logger.error('Error searching books', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/v1/books/:id
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get book by ID request', {
      bookId: req.params['id'],
      userId: (req as any).user?.id,
    });

    try {
      const book = await BookService.getBookById(req.params['id']);

      res.json({
        success: true,
        data: book,
      });
    } catch (error) {
      logger.error('Error retrieving book', {
        bookId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/v1/books
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Create book request', {
      title: req.body.title,
      isbn: req.body.isbn,
      createdBy: (req as any).user?.id,
    });

    try {
      const book = await BookService.createBook(req.body);

      res.status(201).json({
        success: true,
        data: book,
      });
    } catch (error) {
      logger.error('Error creating book', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PUT /api/v1/books/:id
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Update book request', {
      bookId: req.params['id'],
      updatedBy: (req as any).user?.id,
      fields: Object.keys(req.body),
    });

    try {
      const book = await BookService.updateBook(req.params['id'], req.body);

      res.json({
        success: true,
        data: book,
      });
    } catch (error) {
      logger.error('Error updating book', {
        bookId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PATCH /api/v1/books/:id
router.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Partial update book request', {
      bookId: req.params['id'],
      updatedBy: (req as any).user?.id,
      fields: Object.keys(req.body),
    });

    try {
      const book = await BookService.updateBook(req.params['id'], req.body);

      res.json({
        success: true,
        data: book,
      });
    } catch (error) {
      logger.error('Error updating book', {
        bookId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// DELETE /api/v1/books/:id
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Delete book request', {
      bookId: req.params['id'],
      deletedBy: (req as any).user?.id,
    });

    try {
      await BookService.deleteBook(req.params['id']);

      res.json({
        success: true,
        message: 'Book deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting book', {
        bookId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/v1/books/:id/availability
router.get(
  '/:id/availability',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Check book availability request', {
      bookId: req.params['id'],
      userId: (req as any).user?.id,
    });

    try {
      const availability = await BookService.getBookAvailability(
        req.params['id'],
      );

      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      logger.error('Error checking book availability', {
        bookId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/v1/books/:id/reserve
router.post(
  '/:id/reserve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Reserve book request', {
      bookId: req.params['id'],
      userId: (req as any).user?.id,
    });

    // TODO: Implement book reservation
    res.status(501).json({
      message: 'Book reservation feature not yet implemented',
      endpoint: 'POST /api/v1/books/:id/reserve',
      status: 'pending_implementation',
    });
  }),
);

// DELETE /api/v1/books/:id/reserve
router.delete(
  '/:id/reserve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Cancel book reservation request', {
      bookId: req.params['id'],
      userId: (req as any).user?.id,
    });

    // TODO: Implement cancel book reservation
    res.status(501).json({
      message: 'Cancel book reservation feature not yet implemented',
      endpoint: 'DELETE /api/v1/books/:id/reserve',
      status: 'pending_implementation',
    });
  }),
);

// GET /api/v1/books/:id/history
router.get(
  '/:id/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get book history request', {
      bookId: req.params['id'],
      userId: (req as any).user?.id,
      query: req.query,
    });

    try {
      const history = await BookService.getBookHistory(req.params['id'], {
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1,
        limit: req.query['limit']
          ? parseInt(req.query['limit'] as string, 10)
          : 10,
        dateFrom: req.query['dateFrom']
          ? new Date(req.query['dateFrom'] as string)
          : undefined,
        dateTo: req.query['dateTo']
          ? new Date(req.query['dateTo'] as string)
          : undefined,
      });

      res.json({
        success: true,
        data: history.history,
        pagination: {
          total: history.total,
          page: history.page,
          limit: history.limit,
          pages: Math.ceil(history.total / history.limit),
        },
      });
    } catch (error) {
      logger.error('Error retrieving book history', {
        bookId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/v1/books/search
// GET /api/v1/books/categories
router.get(
  '/categories',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get book categories request', {
      userId: (req as any).user?.id,
    });

    try {
      const categories = await BookService.getCategories();

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      logger.error('Error retrieving categories', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

export default router;
