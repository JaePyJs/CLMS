"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookService_1 = require("@/services/bookService");
const logger_1 = require("@/utils/logger");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { category, subcategory, isActive, page = '1', limit = '50', search, } = req.query;
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
        };
        if (category) {
            options.category = category;
        }
        if (subcategory) {
            options.subcategory = subcategory;
        }
        if (isActive !== undefined) {
            options.isActive = isActive === 'true';
        }
        if (search) {
            options.search = search;
        }
        const result = await (0, bookService_1.getBooks)(options);
        const response = {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching books', {
            error: error.message,
            query: req.query,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Book ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const book = await (0, bookService_1.getBookById)(id);
        if (!book) {
            return res.status(404).json({
                success: false,
                error: 'Book not found',
                timestamp: new Date().toISOString(),
            });
        }
        const response = {
            success: true,
            data: book,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching book', {
            error: error.message,
            id: req.params.id,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/', async (req, res) => {
    try {
        const { isbn, accessionNo, title, author, publisher, category, subcategory, location, totalCopies, availableCopies, } = req.body;
        if (!accessionNo || !title || !author || !category) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: accessionNo, title, author, category',
                timestamp: new Date().toISOString(),
            });
        }
        const book = await (0, bookService_1.createBook)({
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
        const response = {
            success: true,
            data: book,
            message: 'Book created successfully',
            timestamp: new Date().toISOString(),
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error creating book', {
            error: error.message,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Book ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const { isbn, accessionNo, title, author, publisher, category, subcategory, location, totalCopies, availableCopies, isActive, } = req.body;
        const book = await (0, bookService_1.updateBook)(id, {
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
        const response = {
            success: true,
            data: book,
            message: 'Book updated successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error updating book', {
            error: error.message,
            id: req.params.id,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Book ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        await (0, bookService_1.deleteBook)(id);
        const response = {
            success: true,
            message: 'Book deleted successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error deleting book', {
            error: error.message,
            id: req.params.id,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/scan', async (req, res) => {
    try {
        const { barcode } = req.body;
        if (!barcode) {
            return res.status(400).json({
                success: false,
                error: 'Barcode is required',
                timestamp: new Date().toISOString(),
            });
        }
        let book = await (0, bookService_1.getBookByAccessionNo)(barcode);
        if (!book) {
            book = await (0, bookService_1.getBookByIsbn)(barcode);
        }
        if (!book) {
            return res.status(404).json({
                success: false,
                error: 'Book not found',
                timestamp: new Date().toISOString(),
            });
        }
        const response = {
            success: true,
            message: 'Book found successfully',
            data: book,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error scanning book barcode', {
            error: error.message,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/checkout', async (req, res) => {
    try {
        const { bookId, studentId, dueDate, notes } = req.body;
        if (!bookId || !studentId || !dueDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: bookId, studentId, dueDate',
                timestamp: new Date().toISOString(),
            });
        }
        const checkout = await (0, bookService_1.checkoutBook)({
            bookId,
            studentId,
            dueDate: new Date(dueDate),
            notes,
        });
        const response = {
            success: true,
            data: checkout,
            message: 'Book checked out successfully',
            timestamp: new Date().toISOString(),
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error checking out book', {
            error: error.message,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/return', async (req, res) => {
    try {
        const { checkoutId } = req.body;
        if (!checkoutId) {
            return res.status(400).json({
                success: false,
                error: 'Checkout ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const checkout = await (0, bookService_1.returnBook)(checkoutId);
        const response = {
            success: true,
            data: checkout,
            message: 'Book returned successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error returning book', {
            error: error.message,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/checkouts/all', async (req, res) => {
    try {
        const { bookId, studentId, status, startDate, endDate, page = '1', limit = '50', } = req.query;
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
        };
        if (bookId) {
            options.bookId = bookId;
        }
        if (studentId) {
            options.studentId = studentId;
        }
        if (status) {
            options.status = status;
        }
        if (startDate) {
            options.startDate = new Date(startDate);
        }
        if (endDate) {
            options.endDate = new Date(endDate);
        }
        const result = await (0, bookService_1.getBookCheckouts)(options);
        const response = {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching book checkouts', {
            error: error.message,
            query: req.query,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/checkouts/overdue', async (req, res) => {
    try {
        const overdueBooks = await (0, bookService_1.getOverdueBooks)();
        const response = {
            success: true,
            data: overdueBooks,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching overdue books', {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
exports.default = router;
//# sourceMappingURL=books.js.map