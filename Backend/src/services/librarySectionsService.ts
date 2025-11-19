/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateSectionData {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateSectionData {
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export class LibrarySectionsService {
  public static async createSection(data: CreateSectionData): Promise<any> {
    try {
      logger.info('Creating library section', { code: data.code });
      const section = await prisma.library_sections.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description ?? null,
          is_active: data.is_active !== undefined ? data.is_active : true,
        },
      });
      logger.info('Library section created', { id: section.id, code: section.code });
      return section;
    } catch (error) {
      logger.error('Create section failed', {
        code: data.code,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async updateSection(id: string, data: UpdateSectionData): Promise<any> {
    try {
      logger.info('Updating library section', { id });
      const section = await prisma.library_sections.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
      logger.info('Library section updated', { id });
      return section;
    } catch (error) {
      logger.error('Update section failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async deleteSection(id: string): Promise<void> {
    try {
      logger.info('Deleting library section', { id });
      await prisma.student_activities_sections.deleteMany({ where: { section_id: id } });
      await prisma.library_sections.delete({ where: { id } });
      logger.info('Library section deleted', { id });
    } catch (error) {
      logger.error('Delete section failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async listSections(onlyActive = false): Promise<any[]> {
    try {
      const sections = await prisma.library_sections.findMany({
        where: onlyActive ? { is_active: true } : {},
        orderBy: { name: 'asc' },
      });
      return sections;
    } catch (error) {
      logger.error('List sections failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getSectionByCode(code: string): Promise<any | null> {
    try {
      const section = await prisma.library_sections.findUnique({ where: { code } });
      return section;
    } catch (error) {
      logger.error('Get section by code failed', {
        code,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async ensureDefaultSections(): Promise<void> {
    const defaults: CreateSectionData[] = [
      { code: 'AVR', name: 'Use of AVR' },
      { code: 'COMPUTER', name: 'Use of Computer' },
      { code: 'LIBRARY_SPACE', name: 'Use of Library Space' },
      { code: 'BORROWING', name: 'Borrow Materials' },
      { code: 'RECREATION', name: 'Use of Recreational Materials' },
    ];
    for (const s of defaults) {
      try {
        const existing = await prisma.library_sections.findUnique({ where: { code: s.code } });
        if (!existing) {
          await prisma.library_sections.create({
            data: { code: s.code, name: s.name, is_active: true },
          });
        }
      } catch (error) {
        logger.error('Ensure default section failed', {
          code: s.code,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
}