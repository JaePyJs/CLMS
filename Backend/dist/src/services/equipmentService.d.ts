import { EquipmentStatus, ActivityType, EquipmentType } from '@prisma/client';
export interface GetEquipmentOptions {
    type?: EquipmentType;
    status?: EquipmentStatus;
    page?: number;
    limit?: number;
    search?: string;
}
export interface GetEquipmentUsageHistoryOptions {
    equipmentId?: string;
    studentId?: string;
    activityType?: ActivityType;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}
export declare function getEquipment(options?: GetEquipmentOptions): Promise<{
    equipment: {
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
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
export declare function getEquipmentById(id: string): Promise<({
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
}) | null>;
export declare function getEquipmentByEquipmentId(equipmentId: string): Promise<({
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
}) | null>;
export declare function createEquipment(data: {
    equipmentId: string;
    name: string;
    type: EquipmentType;
    location: string;
    maxTimeMinutes: number;
    requiresSupervision?: boolean;
    description?: string;
}): Promise<{
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
}>;
export declare function updateEquipment(id: string, data: {
    equipmentId?: string;
    name?: string;
    type?: EquipmentType;
    location?: string;
    maxTimeMinutes?: number;
    requiresSupervision?: boolean;
    description?: string;
    status?: EquipmentStatus;
}): Promise<{
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
}>;
export declare function deleteEquipment(id: string): Promise<boolean>;
export declare function useEquipment(data: {
    equipmentId: string;
    studentId: string;
    activityType: ActivityType;
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
export declare function releaseEquipment(activityId: string): Promise<{
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
export declare function getEquipmentUsageHistory(options?: GetEquipmentUsageHistoryOptions): Promise<{
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
            location: string;
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
export declare function getEquipmentStatistics(): Promise<{
    total: number;
    available: number;
    inUse: number;
    maintenance: number;
    byType: {
        type: import(".prisma/client").$Enums.EquipmentType;
        count: number;
    }[];
}>;
//# sourceMappingURL=equipmentService.d.ts.map