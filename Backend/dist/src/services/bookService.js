"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBooks = getBooks;
exports.getBookById = getBookById;
exports.getBookByAccessionNo = getBookByAccessionNo;
exports.getBookByIsbn = getBookByIsbn;
exports.createBook = createBook;
exports.updateBook = updateBook;
exports.deleteBook = deleteBook;
exports.checkoutBook = checkoutBook;
exports.returnBook = returnBook;
exports.getBookCheckouts = getBookCheckouts;
exports.getOverdueBooks = getOverdueBooks;
const logger_1 = require("@/utils/logger");
const repositories_1 = require("@/repositories");
const prisma_1 = require("@/utils/prisma");
const booksRepository = new repositories_1.BooksRepository();
async function getBooks(options = {}) {
    try {
        const queryOptions = {
            page: options.page ?? 1,
            limit: options.limit ?? 50,
        };
        if (options.category !== undefined) {
            queryOptions.category = options.category;
        }
        if (options.subcategory !== undefined) {
            queryOptions.subcategory = options.subcategory;
        }
        if (options.isActive !== undefined) {
            queryOptions.isActive = options.isActive;
        }
        if (options.search !== undefined) {
            queryOptions.search = options.search;
        }
        const result = await booksRepository.getBooks(queryOptions);
        return {
            books: result.books,
            pagination: result.pagination,
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching books', {
            error: error.message,
            options,
        });
        throw error;
    }
}
async function getBookById(id) {
    try {
        const book = await booksRepository.findById(id);
        return book;
    }
    catch (error) {
        logger_1.logger.error('Error fetching book by ID', {
            error: error.message,
            id,
        });
        throw error;
    }
}
async function getBookByAccessionNo(accession_no) {
    try {
        const book = await prisma_1.prisma.books.findUnique({
            where: { accession_no: accession_no },
        });
        return book;
    }
    catch (error) {
        logger_1.logger.error('Error fetching book by accession number', {
            error: error.message,
            accession_no,
        });
        throw error;
    }
}
async function getBookByIsbn(isbn) {
    try {
        const book = await booksRepository.findByIsbn(isbn);
        return book;
    }
    catch (error) {
        logger_1.logger.error('Error fetching book by ISBN', {
            error: error.message,
            isbn,
        });
        throw error;
    }
}
async function createBook(data) {
    try {
        const bookData = {
            accession_no: data.accession_no,
            title: data.title,
            author: data.author,
            category: data.category,
        };
        if (data.isbn !== undefined) {
            bookData.isbn = data.isbn;
        }
        if (data.publisher !== undefined) {
            bookData.publisher = data.publisher;
        }
        if (data.subcategory !== undefined) {
            bookData.subcategory = data.subcategory;
        }
        if (data.location !== undefined) {
            bookData.location = data.location;
        }
        if (data.totalCopies !== undefined) {
            bookData.total_copies = data.totalCopies;
        }
        if (data.availableCopies !== undefined) {
            bookData.available_copies = data.availableCopies;
        }
        const book = await booksRepository.createBook(bookData);
        return book;
    }
    catch (error) {
        logger_1.logger.error('Error creating book', {
            error: error.message,
            data,
        });
        throw error;
    }
}
async function updateBook(id, data) {
    try {
        const book = await booksRepository.updateById(id, data);
        if (!book) {
            logger_1.logger.warn('Attempted to update non-existent book', { book_id: id });
            return null;
        }
        logger_1.logger.info('Book updated successfully', { book_id: id });
        return book;
    }
    catch (error) {
        logger_1.logger.error('Error updating book', {
            error: error.message,
            id,
            data,
        });
        throw error;
    }
}
async function deleteBook(id) {
    try {
        const success = await booksRepository.deleteById(id);
        if (!success) {
            logger_1.logger.warn('Attempted to delete non-existent book', { book_id: id });
            return false;
        }
        logger_1.logger.info('Book deleted successfully', { book_id: id });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Error deleting book', {
            error: error.message,
            id,
        });
        throw error;
    }
}
async function checkoutBook(data) {
    try {
        const book = await prisma_1.prisma.books.findUnique({
            where: { id: data.book_id },
        });
        if (!book) {
            throw new Error('Book not found');
        }
        if (book.available_copies <= 0) {
            throw new Error('No copies available for checkout');
        }
        const checkout = await prisma_1.prisma.book_checkouts.create({
            data: {
                id: `checkout-${Date.now()}`,
                updated_at: new Date(),
                book_id: data.book_id,
                student_id: data.student_id,
                due_date: data.due_date,
                notes: data.notes || null,
                processed_by: 'Sophia',
            },
        });
        await booksRepository.updateAvailability(data.book_id, 1, 'decrement');
        logger_1.logger.info('Book checked out successfully', {
            checkout_id: checkout.id,
            book_id: data.book_id,
            student_id: data.student_id,
        });
        return checkout;
    }
    catch (error) {
        logger_1.logger.error('Error checking out book', {
            error: error.message,
            data,
        });
        throw error;
    }
}
async function returnBook(checkout_id) {
    try {
        const checkout = await prisma_1.prisma.book_checkouts.findUnique({
            where: { id: checkout_id },
        });
        if (!checkout) {
            throw new Error('Checkout record not found');
        }
        if (checkout.status !== 'ACTIVE') {
            throw new Error('Book is already returned');
        }
        const returnDate = new Date();
        let overdueDays = 0;
        let fineAmount = 0;
        if (returnDate > checkout.due_date) {
            overdueDays = Math.ceil((returnDate.getTime() - checkout.due_date.getTime()) /
                (1000 * 60 * 60 * 24));
            fineAmount = overdueDays * 1.0;
        }
        const updatedCheckout = await prisma_1.prisma.book_checkouts.update({
            where: { id: checkout_id },
            data: {
                return_date: returnDate,
                status: 'RETURNED',
                overdue_days: overdueDays,
                fine_amount: fineAmount,
                updated_at: new Date(),
            },
        });
        await prisma_1.prisma.books.update({
            where: { id: checkout.book_id },
            data: {
                available_copies: {
                    increment: 1,
                },
            },
        });
        logger_1.logger.info('Book returned successfully', {
            checkout_id,
            book_id: checkout.book_id,
            overdue_days: overdueDays,
            fine_amount: fineAmount,
        });
        return updatedCheckout;
    }
    catch (error) {
        logger_1.logger.error('Error returning book', {
            error: error.message,
            checkout_id,
        });
        throw error;
    }
}
async function getBookCheckouts(options = {}) {
    try {
        const { book_id, student_id, status, startDate, endDate, page = 1, limit = 50, } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (book_id) {
            where.book_id = book_id;
        }
        if (student_id) {
            where.student_id = student_id;
        }
        if (status) {
            where.status = status;
        }
        if (startDate || endDate) {
            where.checkout_date = {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
            };
        }
        const [checkouts, total] = await Promise.all([
            prisma_1.prisma.book_checkouts.findMany({
                where,
                skip,
                take: limit,
                orderBy: { checkout_date: 'desc' },
            }),
            prisma_1.prisma.book_checkouts.count({ where }),
        ]);
        return {
            checkouts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching book checkouts', {
            error: error.message,
            options,
        });
        throw error;
    }
}
async function getOverdueBooks() {
    try {
        const overdueCheckouts = await prisma_1.prisma.book_checkouts.findMany({
            where: {
                status: 'ACTIVE',
                due_date: { lt: new Date() },
            },
        });
        const today = new Date();
        const overdueBooks = overdueCheckouts.map(checkout => {
            const overdueDays = Math.ceil((today.getTime() - checkout.due_date.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...checkout,
                overdue_days: overdueDays,
                fine_amount: overdueDays * 1.0,
            };
        });
        return overdueBooks;
    }
    catch (error) {
        logger_1.logger.error('Error fetching overdue books', {
            error: error.message,
        });
        throw error;
    }
}
