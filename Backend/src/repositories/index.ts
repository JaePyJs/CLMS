/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Repository Pattern Implementation
 * Provides data access abstraction layer for Prisma
 */

import { prisma } from '../utils/prisma';

/**
 * Notifications Repository
 */
export class NotificationsRepository {
  static async create(data: any) {
    return prisma.app_notifications.create({ data });
  }

  static async createNotification(data: any) {
    return prisma.app_notifications.create({ data });
  }

  static async findMany(where?: any) {
    return prisma.app_notifications.findMany({ where });
  }

  static async getNotifications(userId: string, options: any = {}) {
    return prisma.app_notifications.findMany({
      where: {
        userId: userId,
        ...options.where,
      },
      orderBy: options.orderBy || { createdAt: 'desc' },
      take: options.limit || 50,
    });
  }

  static async findById(id: string) {
    return prisma.app_notifications.findUnique({ where: { id } });
  }

  static async update(id: string, data: any) {
    return prisma.app_notifications.update({ where: { id }, data });
  }

  static async markAsRead(id: string) {
    return prisma.app_notifications.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.app_notifications.updateMany({
      where: { userId: userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  static async delete(id: string) {
    return prisma.app_notifications.delete({ where: { id } });
  }

  static async deleteNotification(id: string) {
    return prisma.app_notifications.delete({ where: { id } });
  }

  static async deleteReadNotifications(userId: string) {
    return prisma.app_notifications.deleteMany({
      where: { userId: userId, read: true },
    });
  }

  static async cleanupExpiredNotifications(days: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return prisma.app_notifications.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        read: true,
      },
    });
  }

  static async count(where?: any) {
    return prisma.app_notifications.count({ where });
  }
}

/**
 * Users Repository
 */
export class UsersRepository {
  static async findById(id: string) {
    return prisma.users.findUnique({ where: { id } });
  }

  static async findMany(where?: any) {
    return prisma.users.findMany({ where });
  }

  static async update(id: string, data: any) {
    return prisma.users.update({ where: { id }, data });
  }
}
