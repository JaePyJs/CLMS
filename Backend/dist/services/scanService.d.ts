import { ActivityType } from '@prisma/client';
export interface ScanResult {
    type: 'student' | 'book' | 'equipment' | 'unknown';
    data: any;
    message: string;
    timestamp: string;
}
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
    id: string;
    studentId: string;
    createdAt: Date;
    updatedAt: Date;
    equipmentId: string | null;
    status: import(".prisma/client").$Enums.ActivityStatus;
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
    id: string;
    studentId: string;
    createdAt: Date;
    updatedAt: Date;
    equipmentId: string | null;
    status: import(".prisma/client").$Enums.ActivityStatus;
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
    id: string;
    studentId: string;
    createdAt: Date;
    updatedAt: Date;
    equipmentId: string | null;
    status: import(".prisma/client").$Enums.ActivityStatus;
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
    id: string;
    studentId: string;
    createdAt: Date;
    updatedAt: Date;
    equipmentId: string | null;
    status: import(".prisma/client").$Enums.ActivityStatus;
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
            id: string;
            studentId: string;
            createdAt: Date;
            updatedAt: Date;
            equipmentId: string | null;
            status: import(".prisma/client").$Enums.ActivityStatus;
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
        id: string;
        studentId: string;
        firstName: string;
        lastName: string;
        gradeLevel: string;
        gradeCategory: import(".prisma/client").$Enums.GradeCategory;
        section: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        barcodeImage: string | null;
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
        id: string;
        studentId: string;
        createdAt: Date;
        updatedAt: Date;
        equipmentId: string | null;
        status: import(".prisma/client").$Enums.ActivityStatus;
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
}>;
export declare function getBookStatus(bookId: string): Promise<{
    book: {
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
            id: string;
            studentId: string;
            createdAt: Date;
            updatedAt: Date;
            equipmentId: string | null;
            status: import(".prisma/client").$Enums.ActivityStatus;
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
        id: string;
        type: import(".prisma/client").$Enums.EquipmentType;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        location: string;
        equipmentId: string;
        status: import(".prisma/client").$Enums.EquipmentStatus;
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
        id: string;
        studentId: string;
        createdAt: Date;
        updatedAt: Date;
        equipmentId: string | null;
        status: import(".prisma/client").$Enums.ActivityStatus;
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
//# sourceMappingURL=scanService.d.ts.map