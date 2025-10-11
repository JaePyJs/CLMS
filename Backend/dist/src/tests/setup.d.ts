import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<{
    datasources: {
        db: {
            url: string;
        };
    };
    log: "error"[];
    errorFormat: "minimal";
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare function generateTestStudentId(testName: string): string;
export { prisma };
//# sourceMappingURL=setup.d.ts.map