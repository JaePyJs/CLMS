/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreatePolicyData {
  name?: string;
  category: string;
  loan_days: number;
  overnight?: boolean;
  is_active?: boolean;
}

export interface UpdatePolicyData {
  name?: string;
  category?: string;
  loan_days?: number;
  overnight?: boolean;
  is_active?: boolean;
}

export class BorrowingPolicyService {
  public static async createPolicy(data: CreatePolicyData): Promise<any> {
    try {
      logger.info('Creating borrowing policy', { category: data.category });
      const policy = await prisma.borrowing_policies.create({
        data: {
          name: data.name ?? null,
          category: data.category,
          loan_days: data.loan_days,
          overnight: data.overnight ?? false,
          is_active: data.is_active !== undefined ? data.is_active : true,
        },
      });
      logger.info('Borrowing policy created', { id: policy.id });
      return policy;
    } catch (error) {
      logger.error('Create policy failed', {
        category: data.category,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async updatePolicy(id: string, data: UpdatePolicyData): Promise<any> {
    try {
      logger.info('Updating borrowing policy', { id });
      const policy = await prisma.borrowing_policies.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
      logger.info('Borrowing policy updated', { id });
      return policy;
    } catch (error) {
      logger.error('Update policy failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async listPolicies(activeOnly = false): Promise<any[]> {
    try {
      const policies = await prisma.borrowing_policies.findMany({
        where: activeOnly ? { is_active: true } : {},
        orderBy: { category: 'asc' },
      });
      return policies;
    } catch (error) {
      logger.error('List policies failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getPolicyByCategory(category: string): Promise<any | null> {
    try {
      const policy = await prisma.borrowing_policies.findUnique({ where: { category } });
      return policy;
    } catch (error) {
      logger.error('Get policy by category failed', {
        category,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static computeDueDate(checkoutDate: Date, policy: { loan_days: number; overnight: boolean }): Date {
    if (policy.overnight) {
      return addDays(checkoutDate, 1);
    }
    return addDays(checkoutDate, Math.max(1, policy.loan_days));
  }

  public static async assignDefaultPolicyToBook(bookId: string, policyId: string): Promise<any> {
    try {
      logger.info('Assigning default policy to book', { bookId, policyId });
      const book = await prisma.books.update({
        where: { id: bookId },
        data: { default_policy_id: policyId },
      });
      return book;
    } catch (error) {
      logger.error('Assign default policy failed', {
        bookId,
        policyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}