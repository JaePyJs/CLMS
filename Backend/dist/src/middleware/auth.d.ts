import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '@/services/authService';
export interface EnhancedJWTPayload extends JWTPayload {
    sessionId?: string;
    sub?: string;
    iss?: string;
    aud?: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: EnhancedJWTPayload;
        }
    }
}
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authorize: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuthenticate: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireLibrarian: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map