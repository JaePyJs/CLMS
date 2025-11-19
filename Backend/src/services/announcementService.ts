/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';


export interface CreateAnnouncementData {
  title: string;
  content: string;
  start_time: Date;
  end_time?: Date;
  is_active?: boolean;
  priority?: string;
}

export interface UpdateAnnouncementData {
  title?: string;
  content?: string;
  start_time?: Date;
  end_time?: Date | null;
  is_active?: boolean;
  priority?: string;
}

export class AnnouncementService {
  public static async create(data: CreateAnnouncementData): Promise<any> {
    try {
      const a = await prisma.announcements.create({
        data: {
          title: data.title,
          content: data.content,
          start_time: data.start_time,
          end_time: data.end_time ?? null,
          is_active: data.is_active !== undefined ? data.is_active : true,
          priority: data.priority ?? 'NORMAL',
        },
      });
      return a;
    } catch (error) {
      logger.error('Create announcement failed', {
        title: data.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async update(id: string, data: UpdateAnnouncementData): Promise<any> {
    try {
      const a = await prisma.announcements.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
      return a;
    } catch (error) {
      logger.error('Update announcement failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async delete(id: string): Promise<void> {
    try {
      await prisma.announcements.delete({ where: { id } });
    } catch (error) {
      logger.error('Delete announcement failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async listActive(now: Date = new Date()): Promise<any[]> {
    try {
      const active = await prisma.announcements.findMany({
        where: {
          is_active: true,
          start_time: { lte: now },
          OR: [{ end_time: null }, { end_time: { gte: now } }],
        },
        orderBy: [{ priority: 'desc' }, { start_time: 'desc' }],
      });
      return active;
    } catch (error) {
      logger.error('List active announcements failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async listAll(): Promise<any[]> {
    try {
      const all = await prisma.announcements.findMany({ orderBy: { created_at: 'desc' } });
      return all;
    } catch (error) {
      logger.error('List announcements failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}