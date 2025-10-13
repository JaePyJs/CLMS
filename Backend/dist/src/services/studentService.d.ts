import { students_grade_category, student_activities_activity_type, student_activities_status } from '@prisma/client';
export interface GetStudentsOptions {
    gradeCategory?: students_grade_category;
    isActive?: boolean;
    page?: number;
    limit?: number;
}
export interface GetStudentActivitiesOptions {
    student_id?: string;
    startDate?: Date;
    endDate?: Date;
    activityType?: student_activities_activity_type;
    status?: student_activities_status;
    page?: number;
    limit?: number;
}
export declare function getDefaultTimeLimit(grade_category: students_grade_category): number;
export declare function getStudentByBarcode(barcode: string): Promise<{
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
} | null>;
export declare function getStudentById(id: string): Promise<{
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
} | null>;
export declare function getStudents(options?: GetStudentsOptions): Promise<{
    students: {
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
    student_id: string;
    first_name: string;
    last_name: string;
    grade_level: string;
    grade_category: students_grade_category;
    section?: string;
}): Promise<{
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
}>;
export declare function updateStudent(identifier: string, data: {
    firstName?: string;
    lastName?: string;
    gradeLevel?: string;
    gradeCategory?: students_grade_category;
    section?: string;
    isActive?: boolean;
}): Promise<{
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
} | null>;
export declare function deleteStudent(identifier: string): Promise<{
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
} | null>;
export declare function getStudentActivities(options?: GetStudentActivitiesOptions): Promise<{
    activities: {
        id: string;
        student_id: string;
        status: import(".prisma/client").$Enums.student_activities_status;
        updated_at: Date;
        created_at: Date;
        grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
        grade_level: string | null;
        equipment_id: string | null;
        student_name: string | null;
        activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
        checkout_id: string | null;
        start_time: Date;
        end_time: Date | null;
        duration_minutes: number | null;
        time_limit_minutes: number | null;
        notes: string | null;
        processed_by: string;
        google_synced: boolean;
        sync_attempts: number;
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
export declare function getActiveSessions(): Promise<{
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.student_activities_status;
    updated_at: Date;
    created_at: Date;
    grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
    grade_level: string | null;
    equipment_id: string | null;
    student_name: string | null;
    activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
    checkout_id: string | null;
    start_time: Date;
    end_time: Date | null;
    duration_minutes: number | null;
    time_limit_minutes: number | null;
    notes: string | null;
    processed_by: string;
    google_synced: boolean;
    sync_attempts: number;
}[]>;
export declare function createStudentActivity(data: {
    student_id: string;
    activity_type: student_activities_activity_type;
    equipment_id?: string;
    timeLimitMinutes?: number;
    notes?: string;
}): Promise<{
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.student_activities_status;
    updated_at: Date;
    created_at: Date;
    grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
    grade_level: string | null;
    equipment_id: string | null;
    student_name: string | null;
    activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
    checkout_id: string | null;
    start_time: Date;
    end_time: Date | null;
    duration_minutes: number | null;
    time_limit_minutes: number | null;
    notes: string | null;
    processed_by: string;
    google_synced: boolean;
    sync_attempts: number;
}>;
export declare function endStudentActivity(activityId: string): Promise<{
    id: string;
    student_id: string;
    status: import(".prisma/client").$Enums.student_activities_status;
    updated_at: Date;
    created_at: Date;
    grade_category: import(".prisma/client").$Enums.student_activities_grade_category | null;
    grade_level: string | null;
    equipment_id: string | null;
    student_name: string | null;
    activity_type: import(".prisma/client").$Enums.student_activities_activity_type;
    checkout_id: string | null;
    start_time: Date;
    end_time: Date | null;
    duration_minutes: number | null;
    time_limit_minutes: number | null;
    notes: string | null;
    processed_by: string;
    google_synced: boolean;
    sync_attempts: number;
}>;
//# sourceMappingURL=studentService.d.ts.map