/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
type PaperSize = 'SHORT' | 'LONG';
type ColorLevel = 'BW' | 'HALF_COLOR' | 'FULL_COLOR';
type PrismaModels = {
  printing_pricing: {
    create(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown[]>;
    findFirst(args: unknown): Promise<unknown | null>;
  };
  printing_jobs: {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown[]>;
  };
};
const prismaModels = prisma as unknown as PrismaModels;

export interface CreatePricingData {
  paper_size: PaperSize;
  color_level: ColorLevel;
  price: number;
  currency?: string;
  is_active?: boolean;
}

export interface CreatePrintingJobData {
  student_id?: string;
  guest_name?: string;
  paper_size: PaperSize;
  color_level: ColorLevel;
  pages: number;
}

export class PrintingService {
  public static async createPricing(data: CreatePricingData): Promise<any> {
    try {
      logger.info('Creating printing pricing', {
        paper_size: data.paper_size,
        color_level: data.color_level,
      });
      const pricing = await prisma.printing_pricing.create({
        data: {
          paper_size: data.paper_size,
          color_level: data.color_level,
          price: data.price,
          currency: data.currency ?? 'PHP',
          is_active: data.is_active ?? true,
        },
      });
      return pricing;
    } catch (error) {
      logger.error('Create printing pricing failed', {
        paper_size: data.paper_size,
        color_level: data.color_level,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async listPricing(activeOnly = true): Promise<any[]> {
    try {
      const pricing = await prismaModels.printing_pricing.findMany({
        where: activeOnly ? { is_active: true } : {},
        orderBy: [{ paper_size: 'asc' }, { color_level: 'asc' }],
      });
      return pricing;
    } catch (error) {
      logger.error('List pricing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getActivePrice(
    paper_size: PaperSize,
    color_level: ColorLevel,
  ): Promise<number> {
    const pricing = (await prismaModels.printing_pricing.findFirst({
      where: { paper_size, color_level, is_active: true },
      orderBy: { effective_from: 'desc' },
    })) as { price: number } | null;
    if (!pricing) {
      throw new Error('Pricing not configured');
    }
    return pricing.price;
  }

  public static async createJob(data: CreatePrintingJobData): Promise<any> {
    try {
      if (data.pages <= 0) {
        throw new Error('Pages must be greater than zero');
      }
      if (!data.student_id && !data.guest_name) {
        throw new Error('Either student_id or guest_name is required');
      }

      const pricePerPage = await this.getActivePrice(
        data.paper_size,
        data.color_level,
      );
      const totalCost = pricePerPage * data.pages;
      const job = await prisma.printing_jobs.create({
        data: {
          student_id: data.student_id || undefined,
          guest_name: data.guest_name || undefined,
          paper_size: data.paper_size,
          color_level: data.color_level,
          pages: data.pages,
          price_per_page: pricePerPage,
          total_cost: totalCost,
          paid: false,
        },
      });
      return job;
    } catch (error) {
      logger.error('Create printing job failed', {
        student_id: data.student_id,
        guest_name: data.guest_name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async markJobPaid(
    jobId: string,
    receipt_no?: string,
  ): Promise<any> {
    try {
      const updated = await prismaModels.printing_jobs.update({
        where: { id: jobId },
        data: {
          paid: true,
          paid_at: new Date(),
          receipt_no: receipt_no ?? null,
        },
      });
      return updated;
    } catch (error) {
      logger.error('Mark job paid failed', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async listJobs(
    filters: {
      student_id?: string;
      paid?: boolean;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<any[]> {
    try {
      const where: any = {};
      if (filters.student_id) {
        where.student_id = filters.student_id;
      }
      if (filters.paid !== undefined) {
        where.paid = filters.paid;
      }
      if (filters.startDate || filters.endDate) {
        where.created_at = {};
        if (filters.startDate) {
          where.created_at.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.created_at.lte = filters.endDate;
        }
      }

      const jobs = await prismaModels.printing_jobs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          student: {
            select: {
              first_name: true,
              last_name: true,
              student_id: true,
            },
          },
        },
      });
      return jobs;
    } catch (error) {
      logger.error('List printing jobs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
