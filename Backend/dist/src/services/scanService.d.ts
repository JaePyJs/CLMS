import { getStudentByBarcode } from './studentService';
import { student_activities_activity_type, students_grade_category } from '@prisma/client';
type StudentDetails = Awaited<ReturnType<typeof getStudentByBarcode>>;
export interface ScanResult<T = unknown> {
    type: 'student' | 'book' | 'equipment' | 'unknown';
    data: T;
    message: string;
    timestamp: string;
    requiresRegistration?: boolean;
    isDuplicate?: boolean;
    canCheckOut?: boolean;
}
export interface StudentRegistrationData {
    student_id: string;
    first_name: string;
    last_name: string;
    grade_level: string;
    grade_category: students_grade_category;
    section?: string;
}
export interface StudentScanData {
    student: StudentDetails | null;
    requiresRegistration?: boolean;
    isDuplicate?: boolean;
    canCheckOut?: boolean;
    lastActivity?: unknown;
}
export interface StudentScanResult extends ScanResult<StudentScanData> {
    type: 'student';
}
export declare function registerStudent(registrationData: StudentRegistrationData): Promise<{
    id: string;
    student_id: string;
    updated_at: Date;
    created_at: Date;
    section: string | null;
    barcode_image: string | null;
    first_name: string;
    grade_category: import(".prisma/client").$Enums.students_grade_category;
    grade_level: string;
    is_active: boolean;
    last_name: string;
    equipment_ban: boolean;
    equipment_ban_reason: string | null;
    equipment_ban_until: Date | null;
    fine_balance: number;
    max_concurrent_reservations: number;
}>;
export declare function checkDuplicateScan(student_id: string): Promise<boolean>;
export declare function scanStudentBarcode(student_id: string): Promise<StudentScanResult>;
export declare function scanBarcode(barcode: string): Promise<ScanResult>;
export declare function processStudentCheckIn(student_id: string, activity_type: student_activities_activity_type, notes?: string): Promise<{
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.student_activities_status;
    updated_at: Date;
    created_at: Date;
    grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
    grade_level: string | null;
    equipment_id: string | null;
    notes: string | null;
    student_name: string | null;
    activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
    checkout_id: string | null;
    start_time: Date;
    end_time: Date | null;
    duration_minutes: number | null;
    time_limit_minutes: number | null;
    processed_by: string;
    google_synced: boolean;
    sync_attempts: number;
}>;
export declare function processStudentCheckOut(student_id: string): Promise<{
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.student_activities_status;
    updated_at: Date;
    created_at: Date;
    grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
    grade_level: string | null;
    equipment_id: string | null;
    notes: string | null;
    student_name: string | null;
    activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
    checkout_id: string | null;
    start_time: Date;
    end_time: Date | null;
    duration_minutes: number | null;
    time_limit_minutes: number | null;
    processed_by: string;
    google_synced: boolean;
    sync_attempts: number;
}>;
export declare function processBookCheckout(book_id: string, student_id: string, due_date: Date, notes?: string): Promise<{
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
    fine_amount: import("@prisma/client/runtime/library").Decimal;
    fine_paid: boolean;
    overdue_days: number;
    return_date: Date | null;
}>;
export declare function processBookReturn(checkout_id: string): Promise<{
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
    fine_amount: import("@prisma/client/runtime/library").Decimal;
    fine_paid: boolean;
    overdue_days: number;
    return_date: Date | null;
}>;
export declare function processEquipmentUse(equipment_id: string, student_id: string, activity_type: student_activities_activity_type, notes?: string): Promise<{
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.student_activities_status;
    updated_at: Date;
    created_at: Date;
    grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
    grade_level: string | null;
    equipment_id: string | null;
    notes: string | null;
    student_name: string | null;
    activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
    checkout_id: string | null;
    start_time: Date;
    end_time: Date | null;
    duration_minutes: number | null;
    time_limit_minutes: number | null;
    processed_by: string;
    google_synced: boolean;
    sync_attempts: number;
}>;
export declare function processEquipmentRelease(activityId: string): Promise<{
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.student_activities_status;
    updated_at: Date;
    created_at: Date;
    grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
    grade_level: string | null;
    equipment_id: string | null;
    notes: string | null;
    student_name: string | null;
    activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
    checkout_id: string | null;
    start_time: Date;
    end_time: Date | null;
    duration_minutes: number | null;
    time_limit_minutes: number | null;
    processed_by: string;
    google_synced: boolean;
    sync_attempts: number;
}>;
export declare function getStudentStatus(student_id: string): Promise<{
    student: {
        defaultTimeLimit: number;
        hasActiveSession: boolean;
        id: string;
        student_id: string;
        updated_at: Date;
        created_at: Date;
        section: string | null;
        barcode_image: string | null;
        first_name: string;
        grade_category: import(".prisma/client").$Enums.students_grade_category;
        grade_level: string;
        is_active: boolean;
        last_name: string;
        equipment_ban: boolean;
        equipment_ban_reason: string | null;
        equipment_ban_until: Date | null;
        fine_balance: number;
        max_concurrent_reservations: number;
    };
    hasActiveSession: boolean;
    activeSession: {
        id: string;
        student_id: string;
        status: import(".prisma/client").$Enums.student_activities_status;
        updated_at: Date;
        created_at: Date;
        grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
        grade_level: string | null;
        equipment_id: string | null;
        notes: string | null;
        student_name: string | null;
        activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
        checkout_id: string | null;
        start_time: Date;
        end_time: Date | null;
        duration_minutes: number | null;
        time_limit_minutes: number | null;
        processed_by: string;
        google_synced: boolean;
        sync_attempts: number;
    } | null;
    activeBookCheckouts: number;
    activeBookCheckoutsData: ({
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
        fine_amount: import("@prisma/client/runtime/library").Decimal;
        fine_paid: boolean;
        overdue_days: number;
        return_date: Date | null;
    })[];
    equipmentUsage: number;
    equipmentUsageData: ({
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
        fine_amount: import("@prisma/client/runtime/library").Decimal;
        fine_paid: boolean;
        overdue_days: number;
        return_date: Date | null;
    })[];
}>;
export declare function getBookStatus(book_id: string): Promise<{
    book: {
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
            fine_amount: import("@prisma/client/runtime/library").Decimal;
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
    };
    isAvailable: boolean;
    activeCheckout: ({
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
        fine_amount: import("@prisma/client/runtime/library").Decimal;
        fine_paid: boolean;
        overdue_days: number;
        return_date: Date | null;
    }) | null | undefined;
}>;
export declare function getEquipmentStatus(equipment_id: string): Promise<{
    equipment: {
        type: import(".prisma/client").$Enums.equipment_type;
        id: string;
        status: import(".prisma/client").$Enums.equipment_status;
        updated_at: Date;
        name: string;
        created_at: Date;
        category: string | null;
        description: string | null;
        is_active: boolean;
        location: string;
        equipment_id: string;
        max_time_minutes: number;
        requires_supervision: boolean;
        purchase_date: Date | null;
        purchase_cost: number | null;
        serial_number: string | null;
        asset_tag: string | null;
        warranty_expiry: Date | null;
        condition_rating: import(".prisma/client").$Enums.equipment_condition_rating;
        maintenance_interval: number | null;
        last_maintenance: Date | null;
        next_maintenance: Date | null;
        total_usage_hours: number;
        daily_usage_hours: number;
        qr_code_data: string | null;
        barcode_data: string | null;
        tags: import("@prisma/client/runtime/library").JsonValue | null;
        specifications: import("@prisma/client/runtime/library").JsonValue | null;
        notes: string | null;
    };
    isAvailable: boolean;
    activeSession: {
        id: string;
        student_id: string;
        status: import(".prisma/client").$Enums.student_activities_status;
        updated_at: Date;
        created_at: Date;
        grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
        grade_level: string | null;
        equipment_id: string | null;
        notes: string | null;
        student_name: string | null;
        activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
        checkout_id: string | null;
        start_time: Date;
        end_time: Date | null;
        duration_minutes: number | null;
        time_limit_minutes: number | null;
        processed_by: string;
        google_synced: boolean;
        sync_attempts: number;
    } | null;
}>;
export {};
//# sourceMappingURL=scanService.d.ts.map