// User Management form type definitions

export interface UserFormValues {
  username: string;
  email: string;
  password?: string;
  role: 'LIBRARIAN' | 'ADMIN' | 'STAFF';
  firstName?: string;
  lastName?: string;
  fullName?: string;
  isActive: boolean;
}

export interface UserData {
  id: string;
  username: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}
