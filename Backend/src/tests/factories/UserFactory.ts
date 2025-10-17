import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import type { users, users_role, Prisma } from '@prisma/client';
import { BaseFactory } from './BaseFactory';

/**
 * User Factory
 * 
 * Generates valid user data with proper roles, authentication,
 * and realistic user information that matches the database schema.
 */
export class UserFactory extends BaseFactory<
  users,
  Prisma.usersCreateInput,
  Prisma.usersUpdateInput
> {
  /**
   * Default test password for all generated users
   */
  private static readonly DEFAULT_PASSWORD = 'TestPassword123!';

  /**
   * Realistic usernames for different roles
   */
  private static readonly USERNAMES = {
    [users_role.SUPER_ADMIN]: ['admin', 'superadmin', 'root', 'system'],
    [users_role.ADMIN]: ['library_admin', 'admin_user', 'lib_admin', 'sys_admin'],
    [users_role.LIBRARIAN]: ['librarian', 'library_staff', 'lib_staff', 'circulation'],
    [users_role.ASSISTANT]: ['assistant', 'library_assist', 'lib_assist', 'staff'],
    [users_role.TEACHER]: ['teacher', 'faculty', 'instructor', 'professor'],
    [users_role.VIEWER]: ['viewer', 'readonly', 'guest', 'observer']
  } as const;

  /**
   * Realistic full names for Filipino context
   */
  private static readonly FILIPINO_NAMES = {
    first: [
      'Juan', 'Jose', 'Maria', 'Ana', 'Sofia', 'Miguel', 'Gabriel', 'Andrea',
      'Carlos', 'Patricia', 'Roberto', 'Carmen', 'Antonio', 'Rosa', 'Francisco',
      'Luisa', 'Eduardo', 'Teresa', 'Ricardo', 'Elena', 'Manuel', 'Beatriz'
    ],
    last: [
      'Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Flores', 'Torres', 'Ramos',
      'Rivera', 'Castillo', 'Vargas', 'Del Rosario', 'Aquino', 'Fernando', 'Villanueva',
      'De Leon', 'Lopez', 'Dizon', 'Paredes', 'Molina', 'Salazar', 'Valdez'
    ]
  } as const;

  /**
   * Departments for users
   */
  private static readonly DEPARTMENTS = [
    'Library', 'IT Department', 'Administration', 'Academics', 'Student Affairs',
    'Guidance Office', 'Finance', 'Human Resources', 'Maintenance', 'Security'
  ] as const;

  /**
   * Create a single user with valid data
   */
  async create(overrides: Partial<Prisma.usersCreateInput> = {}): Promise<users> {
    const role = BaseFactory.randomEnum(Object.values(users_role));
    const username = this.generateUsername(role);
    const timestamps = BaseFactory.generateTimestamps({ ageInDays: faker.number.int({ min: 1, max: 365 }) });

    // Hash the password
    const password = overrides.password || UserFactory.DEFAULT_PASSWORD;
    const hashedPassword = await bcrypt.hash(password, 10);

    const baseData: Prisma.usersCreateInput = {
      id: BaseFactory.getNextId('user'),
      username: username,
      password: hashedPassword,
      role: role,
      created_at: timestamps.created_at,
      updated_at: timestamps.updated_at,
      is_active: BaseFactory.randomBoolean(0.95), // 95% active users
      last_login_at: BaseFactory.randomBoolean(0.8) ? BaseFactory.randomRecentDate({ days: 7 }) : null,
      email: this.generateEmail(username),
      full_name: this.generateFullName(),
      permissions: this.generatePermissions(role),
    };

    const finalData = BaseFactory.applyOverrides(baseData, overrides);

    // Validate required fields
    BaseFactory.validateData(finalData, [
      'id', 'username', 'password', 'role'
    ]);

    return finalData as users;
  }

  /**
   * Create user with specific role
   */
  async createWithRole(role: users_role, count: number = 1): Promise<users[]> {
    const users: users[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create({ role }));
    }
    return users;
  }

  /**
   * Create super admin user
   */
  async createSuperAdmin(overrides: Partial<Prisma.usersCreateInput> = {}): Promise<users> {
    return this.create({
      role: users_role.SUPER_ADMIN,
      username: 'superadmin',
      email: 'admin@library.edu',
      full_name: 'System Administrator',
      is_active: true,
      ...overrides
    });
  }

  /**
   * Create admin user
   */
  async createAdmin(overrides: Partial<Prisma.usersCreateInput> = {}): Promise<users> {
    return this.create({
      role: users_role.ADMIN,
      username: 'admin',
      email: 'admin@library.edu',
      full_name: 'Library Administrator',
      is_active: true,
      ...overrides
    });
  }

  /**
   * Create librarian user
   */
  async createLibrarian(overrides: Partial<Prisma.usersCreateInput> = {}): Promise<users> {
    return this.create({
      role: users_role.LIBRARIAN,
      username: 'librarian',
      email: 'librarian@library.edu',
      full_name: 'Head Librarian',
      is_active: true,
      ...overrides
    });
  }

  /**
   * Create assistant user
   */
  async createAssistant(overrides: Partial<Prisma.usersCreateInput> = {}): Promise<users> {
    return this.create({
      role: users_role.ASSISTANT,
      ...overrides
    });
  }

  /**
   * Create teacher user
   */
  async createTeacher(overrides: Partial<Prisma.usersCreateInput> = {}): Promise<users> {
    return this.create({
      role: users_role.TEACHER,
      ...overrides
    });
  }

  /**
   * Create viewer user (read-only access)
   */
  async createViewer(overrides: Partial<Prisma.usersCreateInput> = {}): Promise<users> {
    return this.create({
      role: users_role.VIEWER,
      ...overrides
    });
  }

  /**
   * Create inactive users
   */
  async createInactive(count: number = 1): Promise<users[]> {
    const users: users[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create({
        is_active: false,
        last_login_at: BaseFactory.randomPastDate({ months: 6 })
      }));
    }
    return users;
  }

  /**
   * Create active users
   */
  async createActive(count: number = 1): Promise<users[]> {
    const users: users[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create({
        is_active: true,
        last_login_at: BaseFactory.randomRecentDate({ days: 7 })
      }));
    }
    return users;
  }

  /**
   * Create users with recent login activity
   */
  async createWithRecentLogin(count: number = 1): Promise<users[]> {
    const users: users[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create({
        last_login_at: BaseFactory.randomRecentDate({ hours: 24 }),
        is_active: true
      }));
    }
    return users;
  }

  /**
   * Create users with Filipino names
   */
  async createWithFilipinoNames(count: number = 1): Promise<users[]> {
    const users: users[] = [];
    for (let i = 0; i < count; i++) {
      const firstName = BaseFactory.randomEnum(UserFactory.FILIPINO_NAMES.first);
      const lastName = BaseFactory.randomEnum(UserFactory.FILIPINO_NAMES.last);
      const fullName = `${firstName} ${lastName}`;
      
      users.push(await this.create({
        full_name: fullName,
        username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@library.edu`
      }));
    }
    return users;
  }

  /**
   * Create a complete user hierarchy
   */
  async createCompleteHierarchy(): Promise<{
    superAdmin: users;
    admins: users[];
    librarians: users[];
    assistants: users[];
    teachers: users[];
    viewers: users[];
  }> {
    return {
      superAdmin: await this.createSuperAdmin(),
      admins: await this.createWithRole(users_role.ADMIN, 2),
      librarians: await this.createWithRole(users_role.LIBRARIAN, 3),
      assistants: await this.createWithRole(users_role.ASSISTANT, 5),
      teachers: await this.createWithRole(users_role.TEACHER, 4),
      viewers: await this.createWithRole(users_role.VIEWER, 2)
    };
  }

  /**
   * Create users with different activity patterns
   */
  async createWithActivityPatterns(): Promise<{
    activeUsers: users[];
    inactiveUsers: users[];
    newUsers: users[];
    longTermUsers: users[];
    recentLogins: users[];
    dormantUsers: users[];
  }> {
    const now = new Date();

    // Active users (recent login, active status)
    const activeUsers = await Promise.all(
      Array(15).fill(null).map(() => this.create({
        is_active: true,
        last_login_at: BaseFactory.randomRecentDate({ days: 7 })
      }))
    );

    // Inactive users (no recent login, inactive status)
    const inactiveUsers = await Promise.all(
      Array(5).fill(null).map(() => this.create({
        is_active: false,
        last_login_at: BaseFactory.randomPastDate({ months: 3 })
      }))
    );

    // New users (created recently)
    const newUsers = await Promise.all(
      Array(8).fill(null).map(() => this.create({
        created_at: BaseFactory.randomRecentDate({ days: 30 }),
        last_login_at: BaseFactory.randomRecentDate({ days: 7 })
      }))
    );

    // Long-term users (created long ago)
    const longTermUsers = await Promise.all(
      Array(10).fill(null).map(() => this.create({
        created_at: BaseFactory.randomPastDate({ years: 2 }),
        last_login_at: BaseFactory.randomRecentDate({ days: 3 })
      }))
    );

    // Recent logins (logged in today)
    const recentLogins = await Promise.all(
      Array(6).fill(null).map(() => this.create({
        last_login_at: BaseFactory.randomRecentDate({ hours: 24 }),
        is_active: true
      }))
    );

    // Dormant users (active but no recent login)
    const dormantUsers = await Promise.all(
      Array(4).fill(null).map(() => this.create({
        is_active: true,
        last_login_at: BaseFactory.randomPastDate({ months: 2 })
      }))
    );

    return {
      activeUsers,
      inactiveUsers,
      newUsers,
      longTermUsers,
      recentLogins,
      dormantUsers
    };
  }

  /**
   * Create users with specific permissions scenarios
   */
  async createWithPermissionScenarios(): Promise<{
    fullAccessUsers: users[];
    limitedAccessUsers: users[];
    readOnlyUsers: users[];
    customPermissionUsers: users[];
  }> {
    // Full access users (Super Admin, Admin)
    const fullAccessUsers = await Promise.all([
      this.createSuperAdmin(),
      ...Array(2).fill(null).map(() => this.createAdmin())
    ]);

    // Limited access users (Librarians, Assistants)
    const limitedAccessUsers = await Promise.all([
      ...Array(3).fill(null).map(() => this.createLibrarian()),
      ...Array(4).fill(null).map(() => this.createAssistant())
    ]);

    // Read-only users (Viewers)
    const readOnlyUsers = await Promise.all(
      Array(2).fill(null).map(() => this.createViewer())
    );

    // Custom permission users (Teachers with specific permissions)
    const customPermissionUsers = await Promise.all(
      Array(3).fill(null).map(() => this.create({
        role: users_role.TEACHER,
        permissions: {
          canViewReports: true,
          canCheckOutBooks: true,
          canManageStudents: false,
          canManageEquipment: false,
          canViewAnalytics: true
        }
      }))
    );

    return {
      fullAccessUsers,
      limitedAccessUsers,
      readOnlyUsers,
      customPermissionUsers
    };
  }

  /**
   * Generate username based on role
   */
  private generateUsername(role: users_role): string {
    const baseUsernames = UserFactory.USERNAMES[role];
    const baseUsername = BaseFactory.randomEnum(baseUsernames);
    
    // Add random number or timestamp to make it unique
    const suffix = BaseFactory.randomInt(1, 999);
    return `${baseUsername}${suffix}`;
  }

  /**
   * Generate email based on username
   */
  private generateEmail(username: string): string {
    const domains = ['library.edu', 'school.edu', 'edu.ph'];
    const domain = BaseFactory.randomEnum(domains);
    return `${username}@${domain}`;
  }

  /**
   * Generate realistic full name
   */
  private generateFullName(): string {
    // 70% chance of Filipino name, 30% chance of Western name
    if (BaseFactory.randomBoolean(0.7)) {
      const firstName = BaseFactory.randomEnum(UserFactory.FILIPINO_NAMES.first);
      const lastName = BaseFactory.randomEnum(UserFactory.FILIPINO_NAMES.last);
      return `${firstName} ${lastName}`;
    } else {
      return faker.person.fullName();
    }
  }

  /**
   * Generate permissions based on role
   */
  private generatePermissions(role: users_role): any {
    const basePermissions = {
      canViewDashboard: true,
      canViewReports: true
    };

    switch (role) {
      case users_role.SUPER_ADMIN:
        return {
          ...basePermissions,
          canManageUsers: true,
          canManageSystem: true,
          canManageAllData: true,
          canDeleteData: true,
          canExportData: true,
          canImportData: true,
          canViewAnalytics: true,
          canManageSettings: true
        };

      case users_role.ADMIN:
        return {
          ...basePermissions,
          canManageUsers: false,
          canManageSystem: false,
          canManageAllData: true,
          canDeleteData: true,
          canExportData: true,
          canImportData: true,
          canViewAnalytics: true,
          canManageSettings: false
        };

      case users_role.LIBRARIAN:
        return {
          ...basePermissions,
          canManageStudents: true,
          canManageBooks: true,
          canManageEquipment: true,
          canCheckOutBooks: true,
          canProcessReturns: true,
          canManageFines: true,
          canViewReports: true
        };

      case users_role.ASSISTANT:
        return {
          ...basePermissions,
          canManageStudents: false,
          canManageBooks: false,
          canManageEquipment: false,
          canCheckOutBooks: true,
          canProcessReturns: true,
          canManageFines: false
        };

      case users_role.TEACHER:
        return {
          canViewDashboard: true,
          canViewReports: false,
          canCheckOutBooks: true,
          canProcessReturns: true,
          canViewStudentInfo: true
        };

      case users_role.VIEWER:
        return {
          canViewDashboard: true,
          canViewReports: false,
          canViewStudentInfo: true,
          canViewBookInfo: true,
          canViewEquipmentInfo: true
        };

      default:
        return basePermissions;
    }
  }

  /**
   * Create multiple users with the same role
   */
  async createManyWithRole(role: users_role, count: number): Promise<users[]> {
    const users: users[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create({ role }));
    }
    return users;
  }

  /**
   * Create user with specific password (for testing authentication)
   */
  async createWithPassword(
    password: string,
    overrides: Partial<Prisma.usersCreateInput> = {}
  ): Promise<users> {
    return this.create({
      password: await bcrypt.hash(password, 10),
      ...overrides
    });
  }

  /**
   * Create test user with known credentials
   */
  async createTestUser(
    username: string = 'testuser',
    password: string = UserFactory.DEFAULT_PASSWORD,
    role: users_role = users_role.LIBRARIAN
  ): Promise<users> {
    return this.create({
      username,
      password: await bcrypt.hash(password, 10),
      role,
      email: `${username}@library.edu`,
      full_name: 'Test User',
      is_active: true
    });
  }
}