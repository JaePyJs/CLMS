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
const prisma_1 = require("@/utils/prisma");
const logger_1 = require("@/utils/logger");
const client_1 = require("@prisma/client");
async function getBooks(options = {}) {
    try {
        const { category, subcategory, isActive, page = 1, limit = 50, search, } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (category) {
            where.category = category;
        }
        if (subcategory) {
            where.subcategory = subcategory;
        }
        if (isActive !== undefined) {
            where.isActive = isActive;
        }
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { author: { contains: search } },
                { accessionNo: { contains: search } },
                { isbn: { contains: search } },
            ];
        }
        const [books, total] = await Promise.all([
            prisma_1.prisma.book.findMany({
                where,
                skip,
                take: limit,
                orderBy: { title: 'asc' },
            }),
            prisma_1.prisma.book.count({ where }),
        ]);
        return {
            books,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
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
        const book = await prisma_1.prisma.book.findUnique({
            where: { id },
            include: {
                checkouts: {
                    where: { status: client_1.CheckoutStatus.ACTIVE },
                    orderBy: { checkoutDate: 'desc' },
                    take: 1,
                },
            },
        });
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
async function getBookByAccessionNo(accessionNo) {
    try {
        const book = await prisma_1.prisma.book.findUnique({
            where: { accessionNo },
            include: {
                checkouts: {
                    where: { status: client_1.CheckoutStatus.ACTIVE },
                    orderBy: { checkoutDate: 'desc' },
                    take: 1,
                },
            },
        });
        return book;
    }
    catch (error) {
        logger_1.logger.error('Error fetching book by accession number', {
            error: error.message,
            accessionNo,
        });
        throw error;
    }
}
async function getBookByIsbn(isbn) {
    try {
        const book = await prisma_1.prisma.book.findUnique({
            where: { isbn },
            include: {
                checkouts: {
                    where: { status: client_1.CheckoutStatus.ACTIVE },
                    orderBy: { checkoutDate: 'desc' },
                    take: 1,
                },
            },
        });
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
        const book = await prisma_1.prisma.book.create({
            data: {
                isbn: data.isbn || null,
                accessionNo: data.accessionNo,
                title: data.title,
                author: data.author,
                publisher: data.publisher || null,
                category: data.category,
                subcategory: data.subcategory || null,
                location: data.location || null,
                totalCopies: data.totalCopies || 1,
                availableCopies: data.availableCopies || data.totalCopies || 1,
            },
        });
        logger_1.logger.info('Book created successfully', { accessionNo: book.accessionNo });
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
        const book = await prisma_1.prisma.book.update({
            where: { id },
            data,
        });
        logger_1.logger.info('Book updated successfully', { bookId: id });
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
        await prisma_1.prisma.book.delete({
            where: { id },
        });
        logger_1.logger.info('Book deleted successfully', { bookId: id });
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
        const book = await prisma_1.prisma.book.findUnique({
            where: { id: data.bookId },
        });
        if (!book) {
            throw new Error('Book not found');
        }
        if (book.availableCopies <= 0) {
            throw new Error('No copies available for checkout');
        }
        const checkout = await prisma_1.prisma.bookCheckout.create({
            data: {
                bookId: data.bookId,
                studentId: data.studentId,
                checkoutDate: new Date(),
                dueDate: data.dueDate,
                notes: data.notes || null,
                status: client_1.CheckoutStatus.ACTIVE,
                processedBy: 'System',
            },
            include: {
                book: {
                    select: {
                        accessionNo: true,
                        title: true,
                        author: true,
                    },
                },
                student: {
                    select: {
                        studentId: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
        await prisma_1.prisma.book.update({
            where: { id: data.bookId },
            data: {
                availableCopies: {
                    decrement: 1,
                },
            },
        });
        logger_1.logger.info('Book checked out successfully', {
            checkoutId: checkout.id,
            bookId: data.bookId,
            studentId: data.studentId,
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
async function returnBook(checkoutId) {
    try {
        const checkout = await prisma_1.prisma.bookCheckout.findUnique({
            where: { id: checkoutId },
            include: {
                book: true,
            },
        });
        if (!checkout) {
            throw new Error('Checkout record not found');
        }
        if (checkout.status !== client_1.CheckoutStatus.ACTIVE) {
            throw new Error('Book is already returned');
        }
        const returnDate = new Date();
        let overdueDays = 0;
        let fineAmount = 0;
        if (returnDate > checkout.dueDate) {
            overdueDays = Math.ceil((returnDate.getTime() - checkout.dueDate.getTime()) /
                (1000 * 60 * 60 * 24));
            fineAmount = overdueDays * 1.0;
        }
        const updatedCheckout = await prisma_1.prisma.bookCheckout.update({
            where: { id: checkoutId },
            data: {
                returnDate,
                status: client_1.CheckoutStatus.RETURNED,
                overdueDays,
                fineAmount,
            },
            include: {
                book: {
                    select: {
                        accessionNo: true,
                        title: true,
                        author: true,
                    },
                },
                student: {
                    select: {
                        studentId: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
        await prisma_1.prisma.book.update({
            where: { id: checkout.bookId },
            data: {
                availableCopies: {
                    increment: 1,
                },
            },
        });
        logger_1.logger.info('Book returned successfully', {
            checkoutId,
            bookId: checkout.bookId,
            overdueDays,
            fineAmount,
        });
        return updatedCheckout;
    }
    catch (error) {
        logger_1.logger.error('Error returning book', {
            error: error.message,
            checkoutId,
        });
        throw error;
    }
}
async function getBookCheckouts(options = {}) {
    try {
        const { bookId, studentId, status, startDate, endDate, page = 1, limit = 50, } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (bookId) {
            where.bookId = bookId;
        }
        if (studentId) {
            where.studentId = studentId;
        }
        if (status) {
            where.status = status;
        }
        if (startDate || endDate) {
            where.checkoutDate = {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
            };
        }
        const [checkouts, total] = await Promise.all([
            prisma_1.prisma.bookCheckout.findMany({
                where,
                skip,
                take: limit,
                orderBy: { checkoutDate: 'desc' },
                include: {
                    book: {
                        select: {
                            accessionNo: true,
                            title: true,
                            author: true,
                            category: true,
                        },
                    },
                    student: {
                        select: {
                            studentId: true,
                            firstName: true,
                            lastName: true,
                            gradeLevel: true,
                            gradeCategory: true,
                        },
                    },
                },
            }),
            prisma_1.prisma.bookCheckout.count({ where }),
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
        const overdueCheckouts = await prisma_1.prisma.bookCheckout.findMany({
            where: {
                status: client_1.CheckoutStatus.ACTIVE,
                dueDate: {
                    lt: new Date(),
                },
            },
            orderBy: { dueDate: 'asc' },
            include: {
                book: {
                    select: {
                        accessionNo: true,
                        title: true,
                        author: true,
                        category: true,
                    },
                },
                student: {
                    select: {
                        studentId: true,
                        firstName: true,
                        lastName: true,
                        gradeLevel: true,
                        gradeCategory: true,
                    },
                },
            },
        });
        const today = new Date();
        const overdueBooks = overdueCheckouts.map(checkout => {
            const overdueDays = Math.ceil((today.getTime() - checkout.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...checkout,
                overdueDays,
                fineAmount: overdueDays * 1.0,
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
//# sourceMappingURL=bookService.js.map