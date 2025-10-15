import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import Redis from 'ioredis';
import { SavedSearch, SavedSearchCreate } from './enhancedSearchService';

// Redis client for caching saved searches
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});

const CACHE_TTL = 600; // 10 minutes for saved searches

// Create a new saved search
export async function createSavedSearch(data: SavedSearchCreate): Promise<SavedSearch> {
  try {
    const savedSearch = await prisma.saved_searches.create({
      data: {
        user_id: data.userId,
        name: data.name,
        description: data.description,
        entity_type: data.entityType,
        search_params: data.searchParams,
        is_public: data.isPublic || false,
        enable_notifications: data.enableNotifications || false,
        use_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    logger.info('Saved search created', {
      savedSearchId: savedSearch.id,
      userId: data.userId,
      entityType: data.entityType,
      name: data.name
    });

    // Clear cache for user's saved searches
    await clearUserSavedSearchCache(data.userId);

    return {
      id: savedSearch.id,
      userId: savedSearch.user_id,
      name: savedSearch.name,
      description: savedSearch.description,
      entityType: savedSearch.entity_type,
      searchParams: savedSearch.search_params as any,
      isPublic: savedSearch.is_public,
      enableNotifications: savedSearch.enable_notifications,
      createdAt: savedSearch.created_at,
      updatedAt: savedSearch.updated_at,
      lastUsedAt: savedSearch.last_used_at,
      useCount: savedSearch.use_count,
    };
  } catch (error) {
    logger.error('Error creating saved search', {
      error: (error as Error).message,
      userId: data.userId,
      name: data.name,
    });
    throw error;
  }
}

// Get all saved searches for a user
export async function getUserSavedSearches(
  userId: string,
  options: {
    entityType?: string;
    includePublic?: boolean;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ searches: SavedSearch[], total: number }> {
  try {
    const { entityType, includePublic = false, page = 1, limit = 50 } = options;

    const cacheKey = `user_saved_searches:${userId}:${JSON.stringify(options)}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const skip = (page - 1) * limit;
    const where: any = { user_id: userId };

    if (entityType) {
      where.entity_type = entityType;
    }

    if (includePublic) {
      where.OR = [
        { user_id: userId },
        { is_public: true }
      ];
    }

    const [savedSearches, total] = await Promise.all([
      prisma.saved_searches.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { updated_at: 'desc' },
          { use_count: 'desc' }
        ],
      }),
      prisma.saved_searches.count({ where })
    ]);

    const formattedSearches = savedSearches.map(search => ({
      id: search.id,
      userId: search.user_id,
      name: search.name,
      description: search.description,
      entityType: search.entity_type,
      searchParams: search.search_params as any,
      isPublic: search.is_public,
      enableNotifications: search.enable_notifications,
      createdAt: search.created_at,
      updatedAt: search.updated_at,
      lastUsedAt: search.last_used_at,
      useCount: search.use_count,
    }));

    const result = { searches: formattedSearches, total };

    // Cache the result
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

    return result;
  } catch (error) {
    logger.error('Error getting user saved searches', {
      error: (error as Error).message,
      userId,
      options,
    });
    throw error;
  }
}

// Get a specific saved search by ID
export async function getSavedSearchById(id: string, userId?: string): Promise<SavedSearch | null> {
  try {
    const cacheKey = `saved_search:${id}:${userId || 'public'}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const where: any = { id };
    if (userId) {
      where.OR = [
        { user_id: userId },
        { is_public: true }
      ];
    } else {
      where.is_public = true;
    }

    const savedSearch = await prisma.saved_searches.findFirst({ where });

    if (!savedSearch) {
      return null;
    }

    const formattedSearch = {
      id: savedSearch.id,
      userId: savedSearch.user_id,
      name: savedSearch.name,
      description: savedSearch.description,
      entityType: savedSearch.entity_type,
      searchParams: savedSearch.search_params as any,
      isPublic: savedSearch.is_public,
      enableNotifications: savedSearch.enable_notifications,
      createdAt: savedSearch.created_at,
      updatedAt: savedSearch.updated_at,
      lastUsedAt: savedSearch.last_used_at,
      useCount: savedSearch.use_count,
    };

    // Cache the result
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(formattedSearch));

    return formattedSearch;
  } catch (error) {
    logger.error('Error getting saved search by ID', {
      error: (error as Error).message,
      id,
      userId,
    });
    throw error;
  }
}

// Update a saved search
export async function updateSavedSearch(
  id: string,
  userId: string,
  data: Partial<SavedSearchCreate>
): Promise<SavedSearch> {
  try {
    const existingSearch = await prisma.saved_searches.findFirst({
      where: { id, user_id: userId }
    });

    if (!existingSearch) {
      throw new Error('Saved search not found or access denied');
    }

    const updatedSearch = await prisma.saved_searches.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.entityType && { entity_type: data.entityType }),
        ...(data.searchParams && { search_params: data.searchParams }),
        ...(data.isPublic !== undefined && { is_public: data.isPublic }),
        ...(data.enableNotifications !== undefined && { enable_notifications: data.enableNotifications }),
        updated_at: new Date(),
      },
    });

    logger.info('Saved search updated', {
      savedSearchId: id,
      userId,
      name: data.name
    });

    // Clear cache
    await clearUserSavedSearchCache(userId);

    return {
      id: updatedSearch.id,
      userId: updatedSearch.user_id,
      name: updatedSearch.name,
      description: updatedSearch.description,
      entityType: updatedSearch.entity_type,
      searchParams: updatedSearch.search_params as any,
      isPublic: updatedSearch.is_public,
      enableNotifications: updatedSearch.enable_notifications,
      createdAt: updatedSearch.created_at,
      updatedAt: updatedSearch.updated_at,
      lastUsedAt: updatedSearch.last_used_at,
      useCount: updatedSearch.use_count,
    };
  } catch (error) {
    logger.error('Error updating saved search', {
      error: (error as Error).message,
      id,
      userId,
    });
    throw error;
  }
}

// Delete a saved search
export async function deleteSavedSearch(id: string, userId: string): Promise<void> {
  try {
    const existingSearch = await prisma.saved_searches.findFirst({
      where: { id, user_id: userId }
    });

    if (!existingSearch) {
      throw new Error('Saved search not found or access denied');
    }

    await prisma.saved_searches.delete({
      where: { id }
    });

    logger.info('Saved search deleted', {
      savedSearchId: id,
      userId,
      name: existingSearch.name
    });

    // Clear cache
    await clearUserSavedSearchCache(userId);
  } catch (error) {
    logger.error('Error deleting saved search', {
      error: (error as Error).message,
      id,
      userId,
    });
    throw error;
  }
}

// Record that a saved search was used
export async function recordSavedSearchUse(id: string, userId: string): Promise<void> {
  try {
    await prisma.saved_searches.update({
      where: { id },
      data: {
        last_used_at: new Date(),
        use_count: { increment: 1 },
      },
    });

    // Clear cache for this search
    await redis.del(`saved_search:${id}:${userId}`);
    await clearUserSavedSearchCache(userId);

    logger.debug('Saved search use recorded', { savedSearchId: id, userId });
  } catch (error) {
    logger.error('Error recording saved search use', {
      error: (error as Error).message,
      id,
      userId,
    });
    // Don't throw error for this non-critical operation
  }
}

// Get popular saved searches (public)
export async function getPopularSavedSearches(limit = 10): Promise<SavedSearch[]> {
  try {
    const cacheKey = 'popular_saved_searches';
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const popularSearches = await prisma.saved_searches.findMany({
      where: { is_public: true },
      orderBy: [
        { use_count: 'desc' },
        { updated_at: 'desc' }
      ],
      take: limit,
    });

    const formattedSearches = popularSearches.map(search => ({
      id: search.id,
      userId: search.user_id,
      name: search.name,
      description: search.description,
      entityType: search.entity_type,
      searchParams: search.search_params as any,
      isPublic: search.is_public,
      enableNotifications: search.enable_notifications,
      createdAt: search.created_at,
      updatedAt: search.updated_at,
      lastUsedAt: search.last_used_at,
      useCount: search.use_count,
    }));

    // Cache for longer time since popular searches don't change frequently
    await redis.setex(cacheKey, CACHE_TTL * 2, JSON.stringify(formattedSearches));

    return formattedSearches;
  } catch (error) {
    logger.error('Error getting popular saved searches', {
      error: (error as Error).message,
      limit,
    });
    throw error;
  }
}

// Clear user's saved search cache
async function clearUserSavedSearchCache(userId: string): Promise<void> {
  try {
    const pattern = `user_saved_searches:${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error('Error clearing user saved search cache', {
      error: (error as Error).message,
      userId,
    });
  }
}

// Get saved searches that match new items for notifications
export async function getSavedSearchesForNotifications(entityType: string): Promise<SavedSearch[]> {
  try {
    const searches = await prisma.saved_searches.findMany({
      where: {
        entity_type: entityType,
        enable_notifications: true,
        is_public: true,
      },
      orderBy: { use_count: 'desc' },
    });

    return searches.map(search => ({
      id: search.id,
      userId: search.user_id,
      name: search.name,
      description: search.description,
      entityType: search.entity_type,
      searchParams: search.search_params as any,
      isPublic: search.is_public,
      enableNotifications: search.enable_notifications,
      createdAt: search.created_at,
      updatedAt: search.updated_at,
      lastUsedAt: search.last_used_at,
      useCount: search.use_count,
    }));
  } catch (error) {
    logger.error('Error getting saved searches for notifications', {
      error: (error as Error).message,
      entityType,
    });
    throw error;
  }
}

export default {
  createSavedSearch,
  getUserSavedSearches,
  getSavedSearchById,
  updateSavedSearch,
  deleteSavedSearch,
  recordSavedSearchUse,
  getPopularSavedSearches,
  getSavedSearchesForNotifications,
};