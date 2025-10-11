export interface JWTPayload {
    userId: string;
    username: string;
    role: string;
}
export interface LoginResult {
    success: boolean;
    token?: string;
    user?: {
        id: string;
        username: string;
        role: string;
    };
    error?: string;
}
export interface UserSummary {
    id: string;
    username: string;
    role: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
}
export declare class AuthService {
    private jwtSecret;
    private jwtExpiration;
    constructor();
    login(username: string, password: string): Promise<LoginResult>;
    verifyToken(token: string): JWTPayload | null;
    hashPassword(password: string): Promise<string>;
    createUser(userData: {
        username: string;
        password: string;
        role: string;
        isActive?: boolean;
    }): Promise<{
        success: boolean;
        user?: UserSummary;
        error?: string;
    }>;
    updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    resetPassword(userId: string, newPassword: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getUsers(): Promise<UserSummary[]>;
    getUserById(userId: string): Promise<UserSummary | null>;
    updateUser(userId: string, updateData: {
        username?: string;
        role?: string;
        isActive?: boolean;
    }): Promise<{
        success: boolean;
        user?: UserSummary;
        error?: string;
    }>;
    deleteUser(userId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
}
export declare const authService: AuthService;
export default authService;
//# sourceMappingURL=authService.d.ts.map