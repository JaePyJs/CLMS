import { Prisma, book_checkouts_status } from '@prisma/client';
export interface GetBooksOptions {
    category?: string;
    subcategory?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    search?: string;
}
export interface GetBookCheckoutsOptions {
    book_id?: string;
    student_id?: string;
    status?: typeof book_checkouts_status;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}
export declare function getBooks(options?: GetBooksOptions): Promise<{
    books: {
        id: string;
        updated_at: Date;
        title: string;
        created_at: Date;
        category: string;
        barcode_image: string | null;
        is_active: boolean;
        isbn: string | null;
        author: string;
        publisher: string | null;
        subcategory: string | null;
        location: string | null;
        accession_no: string;
        available_copies: number;
        total_copies: number;
        cost_price: number | null;
        edition: string | null;
        pages: string | null;
        remarks: string | null;
        source_of_fund: string | null;
        volume: string | null;
        year: number | null;
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
export declare function getBookById(id: string): Promise<({
    book_checkouts: {
        id: string;
        student_id: string;
        status: import(".prisma/client").$Enums.book_checkouts_status;
        updated_at: Date;
        created_at: Date;
        notes: string | null;
        processed_by: string;
        book_id: string;
        checkout_date: Date;
        due_date: Date;
        fine_amount: Prisma.Decimal;
        fine_paid: boolean;
        overdue_days: number;
        return_date: Date | null;
    }[];
} & {
    id: string;
    updated_at: Date;
    title: string;
    created_at: Date;
    category: string;
    barcode_image: string | null;
    is_active: boolean;
    isbn: string | null;
    author: string;
    publisher: string | null;
    subcategory: string | null;
    location: string | null;
    accession_no: string;
    available_copies: number;
    total_copies: number;
    cost_price: number | null;
    edition: string | null;
    pages: string | null;
    remarks: string | null;
    source_of_fund: string | null;
    volume: string | null;
    year: number | null;
}) | null>;
export declare function getBookByAccessionNo(accession_no: string): Promise<({
    book_checkouts: {
        id: string;
        student_id: string;
        status: import(".prisma/client").$Enums.book_checkouts_status;
        updated_at: Date;
        created_at: Date;
        notes: string | null;
        processed_by: string;
        book_id: string;
        checkout_date: Date;
        due_date: Date;
        fine_amount: Prisma.Decimal;
        fine_paid: boolean;
        overdue_days: number;
        return_date: Date | null;
    }[];
} & {
    id: string;
    updated_at: Date;
    title: string;
    created_at: Date;
    category: string;
    barcode_image: string | null;
    is_active: boolean;
    isbn: string | null;
    author: string;
    publisher: string | null;
    subcategory: string | null;
    location: string | null;
    accession_no: string;
    available_copies: number;
    total_copies: number;
    cost_price: number | null;
    edition: string | null;
    pages: string | null;
    remarks: string | null;
    source_of_fund: string | null;
    volume: string | null;
    year: number | null;
}) | null>;
export declare function getBookByIsbn(isbn: string): Promise<({
    book_checkouts: {
        id: string;
        student_id: string;
        status: import(".prisma/client").$Enums.book_checkouts_status;
        updated_at: Date;
        created_at: Date;
        notes: string | null;
        processed_by: string;
        book_id: string;
        checkout_date: Date;
        due_date: Date;
        fine_amount: Prisma.Decimal;
        fine_paid: boolean;
        overdue_days: number;
        return_date: Date | null;
    }[];
} & {
    id: string;
    updated_at: Date;
    title: string;
    created_at: Date;
    category: string;
    barcode_image: string | null;
    is_active: boolean;
    isbn: string | null;
    author: string;
    publisher: string | null;
    subcategory: string | null;
    location: string | null;
    accession_no: string;
    available_copies: number;
    total_copies: number;
    cost_price: number | null;
    edition: string | null;
    pages: string | null;
    remarks: string | null;
    source_of_fund: string | null;
    volume: string | null;
    year: number | null;
}) | null>;
export declare function createBook(data: {
    isbn?: string;
    accession_no: string;
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
    updated_at: Date;
    title: string;
    created_at: Date;
    category: string;
    barcode_image: string | null;
    is_active: boolean;
    isbn: string | null;
    author: string;
    publisher: string | null;
    subcategory: string | null;
    location: string | null;
    accession_no: string;
    available_copies: number;
    total_copies: number;
    cost_price: number | null;
    edition: string | null;
    pages: string | null;
    remarks: string | null;
    source_of_fund: string | null;
    volume: string | null;
    year: number | null;
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
    updated_at: Date;
    title: string;
    created_at: Date;
    category: string;
    barcode_image: string | null;
    is_active: boolean;
    isbn: string | null;
    author: string;
    publisher: string | null;
    subcategory: string | null;
    location: string | null;
    accession_no: string;
    available_copies: number;
    total_copies: number;
    cost_price: number | null;
    edition: string | null;
    pages: string | null;
    remarks: string | null;
    source_of_fund: string | null;
    volume: string | null;
    year: number | null;
}>;
export declare function deleteBook(id: string): Promise<boolean>;
export declare function checkoutBook(data: {
    book_id: string;
    student_id: string;
    due_date: Date;
    notes?: string;
}): Promise<{
    books: {
        title: string;
        author: string;
        accession_no: string;
    };
    students: {
        student_id: string;
        first_name: string;
        last_name: string;
    };
} & {
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.book_checkouts_status;
    updated_at: Date;
    created_at: Date;
    notes: string | null;
    processed_by: string;
    book_id: string;
    checkout_date: Date;
    due_date: Date;
    fine_amount: Prisma.Decimal;
    fine_paid: boolean;
    overdue_days: number;
    return_date: Date | null;
}>;
export declare function returnBook(checkout_id: string): Promise<{
    books: {
        title: string;
        author: string;
        accession_no: string;
    };
    students: {
        student_id: string;
        first_name: string;
        last_name: string;
    };
} & {
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.book_checkouts_status;
    updated_at: Date;
    created_at: Date;
    notes: string | null;
    processed_by: string;
    book_id: string;
    checkout_date: Date;
    due_date: Date;
    fine_amount: Prisma.Decimal;
    fine_paid: boolean;
    overdue_days: number;
    return_date: Date | null;
}>;
export declare function getBookCheckouts(options?: GetBookCheckoutsOptions): Promise<{
    checkouts: ({
        books: {
            title: string;
            category: string;
            author: string;
            accession_no: string;
        };
        students: {
            student_id: string;
            first_name: string;
            grade_category: import(".prisma/client").$Enums.students_grade_category;
            grade_level: string;
            last_name: string;
        };
    } & {
        id: string;
        student_id: string;
        status: import(".prisma/client").$Enums.book_checkouts_status;
        updated_at: Date;
        created_at: Date;
        notes: string | null;
        processed_by: string;
        book_id: string;
        checkout_date: Date;
        due_date: Date;
        fine_amount: Prisma.Decimal;
        fine_paid: boolean;
        overdue_days: number;
        return_date: Date | null;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
export declare function getOverdueBooks(): Promise<{
    overdue_days: any;
    fine_amount: number;
    books: {
        title: string;
        category: string;
        author: string;
        accession_no: string;
    };
    students: {
        student_id: string;
        first_name: string;
        grade_category: import(".prisma/client").$Enums.students_grade_category;
        grade_level: string;
        last_name: string;
    };
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.book_checkouts_status;
    updated_at: Date;
    created_at: Date;
    notes: string | null;
    processed_by: string;
    book_id: string;
    checkout_date: Date;
    due_date: Date;
    fine_paid: boolean;
    return_date: Date | null;
}[]>;
//# sourceMappingURL=bookService.d.ts.map