import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import {
  type GetBookCheckoutsOptions,
  type GetBooksOptions,
  getBooks,
  getBookById,
  getBookByAccessionNo,
  getBookByIsbn,
  createBook,
  updateBook,
  deleteBook,
  checkoutBook,
  returnBook,
  getBookCheckouts,
  getOverdueBooks,
} from '@/services/bookService';
import { CheckoutStatus } from '@prisma/client';
import { logger } from '@/utils/logger';

const router = Router();

// Get all books
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      subcategory,
      isActive,
      page = '1',
      limit = '50',
      search,
    } = req.query;

    const options: GetBooksOptions = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    if (category) {
      options.category = category as string;
    }

    if (subcategory) {
      options.subcategory = subcategory as string;
    }

    if (isActive !== undefined) {
      options.isActive = isActive === 'true';
    }

    if (search) {
      options.search = search as string;
    }

    const result = await getBooks(options);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching books', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get book by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Book ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const book = await getBookById(id);

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
        timestamp: new Date().toISOString(),
      });
    }

    const response: ApiResponse = {
      success: true,
      data: book,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching book', {
      error: (error as Error).message,
      id: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Create new book
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      isbn,
      accessionNo,
      title,
      author,
      publisher,
      category,
      subcategory,
      location,
      totalCopies,
      availableCopies,
    } = req.body;

    if (!accessionNo || !title || !author || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: accessionNo, title, author, category',
        timestamp: new Date().toISOString(),
      });
    }

    const book = await createBook({
      isbn,
      accessionNo,
      title,
      author,
      publisher,
      category,
      subcategory,
      location,
      totalCopies,
      availableCopies,
    });

    const response: ApiResponse = {
      success: true,
      data: book,
      message: 'Book created successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating book', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Update book
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Book ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const {
      isbn,
      accessionNo,
      title,
      author,
      publisher,
      category,
      subcategory,
      location,
      totalCopies,
      availableCopies,
      isActive,
    } = req.body;

    const book = await updateBook(id, {
      isbn,
      accessionNo,
      title,
      author,
      publisher,
      category,
      subcategory,
      location,
      totalCopies,
      availableCopies,
      isActive,
    });

    const response: ApiResponse = {
      success: true,
      data: book,
      message: 'Book updated successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error updating book', {
      error: (error as Error).message,
      id: req.params.id,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete book
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Book ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    await deleteBook(id);

    const response: ApiResponse = {
      success: true,
      message: 'Book deleted successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error deleting book', {
      error: (error as Error).message,
      id: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Search book by barcode (accession number)
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({
        success: false,
        error: 'Barcode is required',
        timestamp: new Date().toISOString(),
      });
    }

    // Try to find by accession number first
    let book = await getBookByAccessionNo(barcode);

    // If not found, try by ISBN
    if (!book) {
      book = await getBookByIsbn(barcode);
    }

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
        timestamp: new Date().toISOString(),
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Book found successfully',
      data: book,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error scanning book barcode', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Check out book
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { bookId, studentId, dueDate, notes } = req.body;

    if (!bookId || !studentId || !dueDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookId, studentId, dueDate',
        timestamp: new Date().toISOString(),
      });
    }

    const checkout = await checkoutBook({
      bookId,
      studentId,
      dueDate: new Date(dueDate),
      notes,
    });

    const response: ApiResponse = {
      success: true,
      data: checkout,
      message: 'Book checked out successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error checking out book', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Return book
router.post('/return', async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.body;

    if (!checkoutId) {
      return res.status(400).json({
        success: false,
        error: 'Checkout ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const checkout = await returnBook(checkoutId);

    const response: ApiResponse = {
      success: true,
      data: checkout,
      message: 'Book returned successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error returning book', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get book checkouts
router.get('/checkouts/all', async (req: Request, res: Response) => {
  try {
    const {
      bookId,
      studentId,
      status,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const options: GetBookCheckoutsOptions = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    if (bookId) {
      options.bookId = bookId as string;
    }

    if (studentId) {
      options.studentId = studentId as string;
    }

    if (status) {
      options.status = status as CheckoutStatus;
    }

    if (startDate) {
      options.startDate = new Date(startDate as string);
    }

    if (endDate) {
      options.endDate = new Date(endDate as string);
    }

    const result = await getBookCheckouts(options);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching book checkouts', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get overdue books
router.get('/checkouts/overdue', async (req: Request, res: Response) => {
  try {
    const overdueBooks = await getOverdueBooks();

    const response: ApiResponse = {
      success: true,
      data: overdueBooks,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching overdue books', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
