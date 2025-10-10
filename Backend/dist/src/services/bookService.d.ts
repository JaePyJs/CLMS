import { CheckoutStatus } from '@prisma/client';
export declare function getBooks(options?: {
    category?: string;
    subcategory?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    search?: string;
}): Promise<{
    books: {
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        barcodeImage: string | null;
        isbn: string | null;
        accessionNo: string;
        title: string;
        author: string;
        publisher: string | null;
        category: string;
        subcategory: string | null;
        location: string | null;
        totalCopies: number;
        availableCopies: number;
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
export declare function getBookById(id: string): Promise<({
    checkouts: {
        id: string;
        studentId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.CheckoutStatus;
        notes: string | null;
        processedBy: string;
        bookId: string;
        checkoutDate: Date;
        dueDate: Date;
        returnDate: Date | null;
        overdueDays: number;
        fineAmount: import("@prisma/client/runtime/library").Decimal;
        finePaid: boolean;
    }[];
} & {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    barcodeImage: string | null;
    isbn: string | null;
    accessionNo: string;
    title: string;
    author: string;
    publisher: string | null;
    category: string;
    subcategory: string | null;
    location: string | null;
    totalCopies: number;
    availableCopies: number;
}) | null>;
export declare function getBookByAccessionNo(accessionNo: string): Promise<({
    checkouts: {
        id: string;
        studentId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.CheckoutStatus;
        notes: string | null;
        processedBy: string;
        bookId: string;
        checkoutDate: Date;
        dueDate: Date;
        returnDate: Date | null;
        overdueDays: number;
        fineAmount: import("@prisma/client/runtime/library").Decimal;
        finePaid: boolean;
    }[];
} & {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    barcodeImage: string | null;
    isbn: string | null;
    accessionNo: string;
    title: string;
    author: string;
    publisher: string | null;
    category: string;
    subcategory: string | null;
    location: string | null;
    totalCopies: number;
    availableCopies: number;
}) | null>;
export declare function getBookByIsbn(isbn: string): Promise<({
    checkouts: {
        id: string;
        studentId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.CheckoutStatus;
        notes: string | null;
        processedBy: string;
        bookId: string;
        checkoutDate: Date;
        dueDate: Date;
        returnDate: Date | null;
        overdueDays: number;
        fineAmount: import("@prisma/client/runtime/library").Decimal;
        finePaid: boolean;
    }[];
} & {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    barcodeImage: string | null;
    isbn: string | null;
    accessionNo: string;
    title: string;
    author: string;
    publisher: string | null;
    category: string;
    subcategory: string | null;
    location: string | null;
    totalCopies: number;
    availableCopies: number;
}) | null>;
export declare function createBook(data: {
    isbn?: string;
    accessionNo: string;
    title: string;
    author: string;
    publisher?: string;
    category: string;
    subcategory?: string;
    location?: string;
    totalCopies?: number;
    availableCopies?: number;
}): Promise<{
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    barcodeImage: string | null;
    isbn: string | null;
    accessionNo: string;
    title: string;
    author: string;
    publisher: string | null;
    category: string;
    subcategory: string | null;
    location: string | null;
    totalCopies: number;
    availableCopies: number;
}>;
export declare function updateBook(id: string, data: {
    isbn?: string;
    accessionNo?: string;
    title?: string;
    author?: string;
    publisher?: string;
    category?: string;
    subcategory?: string;
    location?: string;
    totalCopies?: number;
    availableCopies?: number;
    isActive?: boolean;
}): Promise<{
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    barcodeImage: string | null;
    isbn: string | null;
    accessionNo: string;
    title: string;
    author: string;
    publisher: string | null;
    category: string;
    subcategory: string | null;
    location: string | null;
    totalCopies: number;
    availableCopies: number;
}>;
export declare function deleteBook(id: string): Promise<boolean>;
export declare function checkoutBook(data: {
    bookId: string;
    studentId: string;
    dueDate: Date;
    notes?: string;
}): Promise<{
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
    };
    book: {
        accessionNo: string;
        title: string;
        author: string;
    };
} & {
    id: string;
    studentId: string;
    createdAt: Date;
    updatedAt: Date;
    status: import(".prisma/client").$Enums.CheckoutStatus;
    notes: string | null;
    processedBy: string;
    bookId: string;
    checkoutDate: Date;
    dueDate: Date;
    returnDate: Date | null;
    overdueDays: number;
    fineAmount: import("@prisma/client/runtime/library").Decimal;
    finePaid: boolean;
}>;
export declare function returnBook(checkoutId: string): Promise<{
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
    };
    book: {
        accessionNo: string;
        title: string;
        author: string;
    };
} & {
    id: string;
    studentId: string;
    createdAt: Date;
    updatedAt: Date;
    status: import(".prisma/client").$Enums.CheckoutStatus;
    notes: string | null;
    processedBy: string;
    bookId: string;
    checkoutDate: Date;
    dueDate: Date;
    returnDate: Date | null;
    overdueDays: number;
    fineAmount: import("@prisma/client/runtime/library").Decimal;
    finePaid: boolean;
}>;
export declare function getBookCheckouts(options?: {
    bookId?: string;
    studentId?: string;
    status?: CheckoutStatus;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}): Promise<{
    checkouts: ({
        student: {
            studentId: string;
            firstName: string;
            lastName: string;
            gradeLevel: string;
            gradeCategory: import(".prisma/client").$Enums.GradeCategory;
        };
        book: {
            accessionNo: string;
            title: string;
            author: string;
            category: string;
        };
    } & {
        id: string;
        studentId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.CheckoutStatus;
        notes: string | null;
        processedBy: string;
        bookId: string;
        checkoutDate: Date;
        dueDate: Date;
        returnDate: Date | null;
        overdueDays: number;
        fineAmount: import("@prisma/client/runtime/library").Decimal;
        finePaid: boolean;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
export declare function getOverdueBooks(): Promise<{
    overdueDays: number;
    fineAmount: number;
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
        gradeLevel: string;
        gradeCategory: import(".prisma/client").$Enums.GradeCategory;
    };
    book: {
        accessionNo: string;
        title: string;
        author: string;
        category: string;
    };
    id: string;
    studentId: string;
    createdAt: Date;
    updatedAt: Date;
    status: import(".prisma/client").$Enums.CheckoutStatus;
    notes: string | null;
    processedBy: string;
    bookId: string;
    checkoutDate: Date;
    dueDate: Date;
    returnDate: Date | null;
    finePaid: boolean;
}[]>;
//# sourceMappingURL=bookService.d.ts.map