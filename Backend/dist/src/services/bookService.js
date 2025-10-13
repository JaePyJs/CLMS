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
async function getBooks(options = {}) {
    try {
        const { category, subcategory, is_active, page = 1, limit = 50, search, } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (category) {
            where.category = category;
        }
        if (subcategory) {
            where.subcategory = subcategory;
        }
        if (isActive !== undefined) {
            where.is_active = isActive;
        }
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { author: { contains: search } },
                { accession_no: { contains: search } },
                { isbn: { contains: search } },
            ];
        }
        const [books, total] = await Promise.all([
            prisma_1.prisma.books.findMany({
                where,
                skip,
                take: limit,
                orderBy: { title: 'asc' },
            }),
            prisma_1.prisma.books.count({ where }),
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
        const book = await prisma_1.prisma.books.findUnique({
            where: { id },
            include: {
                book_checkouts: {
                    where: { status: 'ACTIVE' },
                    orderBy: { checkout_date: 'desc' },
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
async function getBookByAccessionNo(accession_no) {
    try {
        const book = await prisma_1.prisma.books.findUnique({
            where: { accession_no: accession_no },
            include: {
                book_checkouts: {
                    where: { status: 'ACTIVE' },
                    orderBy: { checkout_date: 'desc' },
                    take: 1,
                },
            },
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
        const book = await prisma_1.prisma.books.findFirst({
            where: { isbn },
            include: {
                book_checkouts: {
                    where: { status: 'ACTIVE' },
                    orderBy: { checkout_date: 'desc' },
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
        const book = await prisma_1.prisma.books.create({
            data: {
                id: `book-${Date.now()}`,
                updated_at: new Date(),
                isbn: data.isbn || null,
                accession_no: data.accession_no,
                title: data.title,
                author: data.author,
                publisher: data.publisher || null,
                category: data.category,
                subcategory: data.subcategory || null,
                location: data.location || null,
                total_copies: data.total_copies || 1,
                available_copies: data.available_copies || data.total_copies || 1,
            },
        });
        logger_1.logger.info('Book created successfully', { accession_no: book.accession_no });
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
        const book = await prisma_1.prisma.books.update({
            where: { id },
            data,
        });
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
        await prisma_1.prisma.books.delete({
            where: { id },
        });
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
                checkout_date: new Date(),
                due_date: data.due_date,
                notes: data.notes || null,
                status: 'ACTIVE',
                processed_by: 'System',
            },
            include: {
                books: {
                    select: {
                        accession_no: true,
                        title: true,
                        author: true,
                    },
                },
                students: {
                    select: {
                        student_id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
        });
        await prisma_1.prisma.books.update({
            where: { id: data.book_id },
            data: {
                available_copies: {
                    decrement: 1,
                },
            },
        });
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
            include: {
                books: true,
            },
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
                return_date: return_date,
                status: 'RETURNED',
                overdue_days: overdue_days,
                fine_amount: fine_amount,
            },
            include: {
                books: {
                    select: {
                        accession_no: true,
                        title: true,
                        author: true,
                    },
                },
                students: {
                    select: {
                        student_id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
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
            overdue_days,
            fine_amount,
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
                include: {
                    books: {
                        select: {
                            accession_no: true,
                            title: true,
                            author: true,
                            category: true,
                        },
                    },
                    students: {
                        select: {
                            student_id: true,
                            first_name: true,
                            last_name: true,
                            grade_level: true,
                            grade_category: true,
                        },
                    },
                },
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
                due_date: {
                    lt: new Date(),
                },
            },
            orderBy: { due_date: 'asc' },
            include: {
                books: {
                    select: {
                        accession_no: true,
                        title: true,
                        author: true,
                        category: true,
                    },
                },
                students: {
                    select: {
                        student_id: true,
                        first_name: true,
                        last_name: true,
                        grade_level: true,
                        grade_category: true,
                    },
                },
            },
        });
        const today = new Date();
        const overdueBooks = overdueCheckouts.map(checkout => {
            const overdueDays = Math.ceil((today.getTime() - checkout.due_date.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...checkout,
                overdue_days,
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
//# sourceMappingURL=bookService.js.map