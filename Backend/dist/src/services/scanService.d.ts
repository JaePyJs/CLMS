import { getStudentByBarcode } from './studentService';
import { ActivityType, GradeCategory } from '@prisma/client';
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
    studentId: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    gradeCategory: GradeCategory;
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
    studentId: string;
    id: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    gradeCategory: import(".prisma/client").$Enums.GradeCategory;
    section: string | null;
    barcodeImage: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function checkDuplicateScan(studentId: string): Promise<boolean>;
export declare function scanStudentBarcode(studentId: string): Promise<StudentScanResult>;
export declare function scanBarcode(barcode: string): Promise<ScanResult>;
export declare function processStudentCheckIn(studentId: string, activityType: ActivityType, notes?: string): Promise<{
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
        gradeLevel: string;
        gradeCategory: import(".prisma/client").$Enums.GradeCategory;
    };
    equipment: {
        type: import(".prisma/client").$Enums.EquipmentType;
        name: string;
        equipmentId: string;
    } | null;
} & {
    studentId: string;
    status: import(".prisma/client").$Enums.ActivityStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    equipmentId: string | null;
    studentName: string | null;
    studentGradeLevel: string | null;
    studentGradeCategory: import(".prisma/client").$Enums.GradeCategory | null;
    activityType: import(".prisma/client").$Enums.ActivityType;
    checkoutId: string | null;
    startTime: Date;
    endTime: Date | null;
    durationMinutes: number | null;
    timeLimitMinutes: number | null;
    notes: string | null;
    processedBy: string;
    googleSynced: boolean;
    syncAttempts: number;
}>;
export declare function processStudentCheckOut(studentId: string): Promise<{
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
    };
} & {
    studentId: string;
    status: import(".prisma/client").$Enums.ActivityStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    equipmentId: string | null;
    studentName: string | null;
    studentGradeLevel: string | null;
    studentGradeCategory: import(".prisma/client").$Enums.GradeCategory | null;
    activityType: import(".prisma/client").$Enums.ActivityType;
    checkoutId: string | null;
    startTime: Date;
    endTime: Date | null;
    durationMinutes: number | null;
    timeLimitMinutes: number | null;
    notes: string | null;
    processedBy: string;
    googleSynced: boolean;
    syncAttempts: number;
}>;
export declare function processBookCheckout(bookId: string, studentId: string, dueDate: Date, notes?: string): Promise<{
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
    studentId: string;
    status: import(".prisma/client").$Enums.CheckoutStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
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
export declare function processBookReturn(checkoutId: string): Promise<{
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
    studentId: string;
    status: import(".prisma/client").$Enums.CheckoutStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
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
export declare function processEquipmentUse(equipmentId: string, studentId: string, activityType: ActivityType, notes?: string): Promise<{
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
        gradeLevel: string;
        gradeCategory: import(".prisma/client").$Enums.GradeCategory;
    };
    equipment: {
        type: import(".prisma/client").$Enums.EquipmentType;
        name: string;
        equipmentId: string;
    } | null;
} & {
    studentId: string;
    status: import(".prisma/client").$Enums.ActivityStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    equipmentId: string | null;
    studentName: string | null;
    studentGradeLevel: string | null;
    studentGradeCategory: import(".prisma/client").$Enums.GradeCategory | null;
    activityType: import(".prisma/client").$Enums.ActivityType;
    checkoutId: string | null;
    startTime: Date;
    endTime: Date | null;
    durationMinutes: number | null;
    timeLimitMinutes: number | null;
    notes: string | null;
    processedBy: string;
    googleSynced: boolean;
    syncAttempts: number;
}>;
export declare function processEquipmentRelease(activityId: string): Promise<{
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
    };
    equipment: {
        type: import(".prisma/client").$Enums.EquipmentType;
        name: string;
        equipmentId: string;
    } | null;
} & {
    studentId: string;
    status: import(".prisma/client").$Enums.ActivityStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    equipmentId: string | null;
    studentName: string | null;
    studentGradeLevel: string | null;
    studentGradeCategory: import(".prisma/client").$Enums.GradeCategory | null;
    activityType: import(".prisma/client").$Enums.ActivityType;
    checkoutId: string | null;
    startTime: Date;
    endTime: Date | null;
    durationMinutes: number | null;
    timeLimitMinutes: number | null;
    notes: string | null;
    processedBy: string;
    googleSynced: boolean;
    syncAttempts: number;
}>;
export declare function getStudentStatus(studentId: string): Promise<{
    student: {
        defaultTimeLimit: number;
        hasActiveSession: boolean;
        activities: {
            studentId: string;
            status: import(".prisma/client").$Enums.ActivityStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            equipmentId: string | null;
            studentName: string | null;
            studentGradeLevel: string | null;
            studentGradeCategory: import(".prisma/client").$Enums.GradeCategory | null;
            activityType: import(".prisma/client").$Enums.ActivityType;
            checkoutId: string | null;
            startTime: Date;
            endTime: Date | null;
            durationMinutes: number | null;
            timeLimitMinutes: number | null;
            notes: string | null;
            processedBy: string;
            googleSynced: boolean;
            syncAttempts: number;
        }[];
        studentId: string;
        id: string;
        firstName: string;
        lastName: string;
        gradeLevel: string;
        gradeCategory: import(".prisma/client").$Enums.GradeCategory;
        section: string | null;
        barcodeImage: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
    hasActiveSession: boolean;
    activeSession: ({
        student: {
            studentId: string;
            firstName: string;
            lastName: string;
            gradeLevel: string;
            gradeCategory: import(".prisma/client").$Enums.GradeCategory;
        };
        equipment: {
            type: import(".prisma/client").$Enums.EquipmentType;
            name: string;
            equipmentId: string;
        } | null;
    } & {
        studentId: string;
        status: import(".prisma/client").$Enums.ActivityStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        equipmentId: string | null;
        studentName: string | null;
        studentGradeLevel: string | null;
        studentGradeCategory: import(".prisma/client").$Enums.GradeCategory | null;
        activityType: import(".prisma/client").$Enums.ActivityType;
        checkoutId: string | null;
        startTime: Date;
        endTime: Date | null;
        durationMinutes: number | null;
        timeLimitMinutes: number | null;
        notes: string | null;
        processedBy: string;
        googleSynced: boolean;
        syncAttempts: number;
    }) | null;
    activeBookCheckouts: number;
    activeBookCheckoutsData: ({
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
        studentId: string;
        status: import(".prisma/client").$Enums.CheckoutStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
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
    equipmentUsage: number;
    equipmentUsageData: ({
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
        studentId: string;
        status: import(".prisma/client").$Enums.CheckoutStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
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
}>;
export declare function getBookStatus(bookId: string): Promise<{
    book: {
        checkouts: {
            studentId: string;
            status: import(".prisma/client").$Enums.CheckoutStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
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
        barcodeImage: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
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
    };
    isAvailable: boolean;
    activeCheckout: ({
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
        studentId: string;
        status: import(".prisma/client").$Enums.CheckoutStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        processedBy: string;
        bookId: string;
        checkoutDate: Date;
        dueDate: Date;
        returnDate: Date | null;
        overdueDays: number;
        fineAmount: import("@prisma/client/runtime/library").Decimal;
        finePaid: boolean;
    }) | null | undefined;
}>;
export declare function getEquipmentStatus(equipmentId: string): Promise<{
    equipment: {
        activities: ({
            student: {
                studentId: string;
                firstName: string;
                lastName: string;
            };
        } & {
            studentId: string;
            status: import(".prisma/client").$Enums.ActivityStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            equipmentId: string | null;
            studentName: string | null;
            studentGradeLevel: string | null;
            studentGradeCategory: import(".prisma/client").$Enums.GradeCategory | null;
            activityType: import(".prisma/client").$Enums.ActivityType;
            checkoutId: string | null;
            startTime: Date;
            endTime: Date | null;
            durationMinutes: number | null;
            timeLimitMinutes: number | null;
            notes: string | null;
            processedBy: string;
            googleSynced: boolean;
            syncAttempts: number;
        })[];
    } & {
        type: import(".prisma/client").$Enums.EquipmentType;
        status: import(".prisma/client").$Enums.EquipmentStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        location: string;
        equipmentId: string;
        maxTimeMinutes: number;
        requiresSupervision: boolean;
        description: string | null;
    };
    isAvailable: boolean;
    activeSession: ({
        student: {
            studentId: string;
            firstName: string;
            lastName: string;
            gradeLevel: string;
            gradeCategory: import(".prisma/client").$Enums.GradeCategory;
        };
        equipment: {
            type: import(".prisma/client").$Enums.EquipmentType;
            name: string;
            equipmentId: string;
        } | null;
    } & {
        studentId: string;
        status: import(".prisma/client").$Enums.ActivityStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        equipmentId: string | null;
        studentName: string | null;
        studentGradeLevel: string | null;
        studentGradeCategory: import(".prisma/client").$Enums.GradeCategory | null;
        activityType: import(".prisma/client").$Enums.ActivityType;
        checkoutId: string | null;
        startTime: Date;
        endTime: Date | null;
        durationMinutes: number | null;
        timeLimitMinutes: number | null;
        notes: string | null;
        processedBy: string;
        googleSynced: boolean;
        syncAttempts: number;
    }) | null;
}>;
export {};
//# sourceMappingURL=scanService.d.ts.map