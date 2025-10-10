import { GradeCategory, ActivityType, ActivityStatus } from '@prisma/client';
export declare function getDefaultTimeLimit(gradeCategory: GradeCategory): number;
export declare function getStudentByBarcode(barcode: string): Promise<{
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
} | null>;
export declare function getStudents(options?: {
    gradeCategory?: GradeCategory;
    isActive?: boolean;
    page?: number;
    limit?: number;
}): Promise<{
    students: {
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
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
export declare function createStudent(data: {
    studentId: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    gradeCategory: GradeCategory;
    section?: string;
}): Promise<{
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
}>;
export declare function updateStudent(studentId: string, data: {
    firstName?: string;
    lastName?: string;
    gradeLevel?: string;
    gradeCategory?: GradeCategory;
    section?: string;
    isActive?: boolean;
}): Promise<{
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
}>;
export declare function deleteStudent(studentId: string): Promise<boolean>;
export declare function getStudentActivities(options?: {
    studentId?: string;
    startDate?: Date;
    endDate?: Date;
    activityType?: ActivityType;
    status?: ActivityStatus;
    page?: number;
    limit?: number;
}): Promise<{
    activities: ({
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
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
export declare function getActiveSessions(): Promise<({
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
})[]>;
export declare function createStudentActivity(data: {
    studentId: string;
    activityType: ActivityType;
    equipmentId?: string;
    timeLimitMinutes?: number;
    notes?: string;
}): Promise<{
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
export declare function endStudentActivity(activityId: string): Promise<{
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
//# sourceMappingURL=studentService.d.ts.map