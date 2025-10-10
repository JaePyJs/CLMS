import { Request, Response, NextFunction } from 'express';
export declare const validationMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const studentValidationRules: {
    create: import("express-validator").ValidationChain[];
    update: import("express-validator").ValidationChain[];
};
export declare const bookValidationRules: {
    create: import("express-validator").ValidationChain[];
    update: import("express-validator").ValidationChain[];
};
export declare const equipmentValidationRules: {
    create: import("express-validator").ValidationChain[];
    update: import("express-validator").ValidationChain[];
};
export declare const activityValidationRules: {
    create: import("express-validator").ValidationChain[];
    update: import("express-validator").ValidationChain[];
};
export declare const paginationValidationRules: import("express-validator").ValidationChain[];
export declare const idValidationRules: import("express-validator").ValidationChain[];
export declare const authValidationRules: {
    login: import("express-validator").ValidationChain[];
};
export declare const systemConfigValidationRules: {
    update: import("express-validator").ValidationChain[];
};
export declare const automationJobValidationRules: {
    create: import("express-validator").ValidationChain[];
    update: import("express-validator").ValidationChain[];
};
//# sourceMappingURL=validation.d.ts.map