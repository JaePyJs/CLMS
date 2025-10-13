export interface JWTPayload {
    id: string;
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
    is_active: boolean;
    last_login_at: Date | null;
    created_at: Date;
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
    updatePassword(id: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    resetPassword(id: string, newPassword: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getUsers(): Promise<UserSummary[]>;
    getUserById(id: string): Promise<UserSummary | null>;
    updateUser(id: string, updateData: {
        username?: string;
        role?: string;
        isActive?: boolean;
    }): Promise<{
        success: boolean;
        user?: UserSummary;
        error?: string;
    }>;
    deleteUser(id: string): Promise<{
        success: boolean;
        error?: string;
    }>;
}
export declare const authService: AuthService;
export default authService;
//# sourceMappingURL=authService.d.ts.map