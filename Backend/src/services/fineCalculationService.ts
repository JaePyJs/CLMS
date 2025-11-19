/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { differenceInCalendarDays } from 'date-fns';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class FineCalculationService {
  public static async getRateForGrade(gradeLevel: number): Promise<number> {
    try {
      const policy = await prisma.fine_policies.findFirst({
        where: {
          is_active: true,
          grade_min: { lte: gradeLevel },
          grade_max: { gte: gradeLevel },
        },
        orderBy: { updated_at: 'desc' },
      });
      if (policy) return policy.rate_per_day;
      if (gradeLevel <= 3) return 2;
      return 5;
    } catch (error) {
      logger.error('Get fine rate failed', {
        gradeLevel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      if (gradeLevel <= 3) return 2;
      return 5;
    }
  }

  public static async calculateFineForCheckout(checkoutId: string, asOfDate?: Date): Promise<any> {
    try {
      const checkout = await prisma.book_checkouts.findUnique({
        where: { id: checkoutId },
        include: { student: true },
      });
      if (!checkout || !checkout.student) {
        throw new Error('Checkout not found');
      }
      const due = new Date(checkout.due_date);
      const ref = asOfDate ? new Date(asOfDate) : new Date(checkout.return_date ?? new Date());
      const daysOverdue = Math.max(0, differenceInCalendarDays(ref, due));
      const rate = await this.getRateForGrade(checkout.student.grade_level);
      const fine = daysOverdue * rate;
      const policy = await prisma.fine_policies.findFirst({
        where: {
          is_active: true,
          grade_min: { lte: checkout.student.grade_level },
          grade_max: { gte: checkout.student.grade_level },
        },
      });
      const updated = await prisma.book_checkouts.update({
        where: { id: checkoutId },
        data: {
          fine_amount: fine,
          fine_policy_id: policy?.id ?? null,
        },
      });
      return { checkout: updated, fine_amount: fine, days_overdue: daysOverdue, rate };
    } catch (error) {
      logger.error('Calculate fine failed', {
        checkoutId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async markFinePaid(checkoutId: string): Promise<any> {
    try {
      const updated = await prisma.book_checkouts.update({
        where: { id: checkoutId },
        data: { fine_paid: true, fine_paid_at: new Date() },
      });
      return updated;
    } catch (error) {
      logger.error('Mark fine paid failed', {
        checkoutId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}