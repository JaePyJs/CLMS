import { GradeCategory, ActivityType, ActivityStatus } from '@prisma/client';
export interface GetStudentsOptions {
    gradeCategory?: GradeCategory;
    isActive?: boolean;
    page?: number;
    limit?: number;
}
export interface GetStudentActivitiesOptions {
    studentId?: string;
    startDate?: Date;
    endDate?: Date;
    activityType?: ActivityType;
    status?: ActivityStatus;
    page?: number;
    limit?: number;
}
export declare function getDefaultTimeLimit(gradeCategory: GradeCategory): number;
export declare function getStudentByBarcode(barcode: string): Promise<{
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
} | null>;
export declare function getStudentById(id: string): Promise<{
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
} | null>;
export declare function getStudents(options?: GetStudentsOptions): Promise<{
    students: {
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
    }[];
    total: number;
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
export declare function updateStudent(identifier: string, data: {
    firstName?: string;
    lastName?: string;
    gradeLevel?: string;
    gradeCategory?: GradeCategory;
    section?: string;
    isActive?: boolean;
}): Promise<{
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
} | null>;
export declare function deleteStudent(identifier: string): Promise<{
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
} | null>;
export declare function getStudentActivities(options?: GetStudentActivitiesOptions): Promise<{
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
export declare function endStudentActivity(activityId: string): Promise<{
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
//# sourceMappingURL=studentService.d.ts.map