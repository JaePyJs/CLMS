import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '@/services/authService';
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => void;
export declare const authorize: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuthenticate: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireLibrarian: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map