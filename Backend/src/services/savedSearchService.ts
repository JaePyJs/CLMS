import enhancedRedis from '@/config/redis';
import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { Prisma } from '@prisma/client';
import { SavedSearch, SavedSearchCreate } from './enhancedSearchService';

// Redis client for caching saved searches
const redis = enhancedRedis.getClient();

type SavedSearchRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  entity_type: string;
  search_params: Prisma.JsonValue | null;
  is_public: boolean;
  enable_notifications: boolean;
  created_at: Date;
  updated_at: Date;
  last_used_at: Date | null;
  use_count: number;
};

type SavedSearchDelegate = {
  create(args: { data: Record<string, unknown> }): Promise<SavedSearchRow>;
  findMany(args: Record<string, unknown>): Promise<SavedSearchRow[]>;
  findFirst(args: Record<string, unknown>): Promise<SavedSearchRow | null>;
  count(args: Record<string, unknown>): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<SavedSearchRow>;
  delete(args: { where: { id: string } }): Promise<SavedSearchRow>;
};

function getSavedSearchDelegate(): SavedSearchDelegate {
  const delegate = (
    prisma as unknown as { saved_searches?: SavedSearchDelegate }
  ).saved_searches;

  if (!delegate) {
    throw new Error('Saved search delegate is not available on Prisma client');
  }

  return delegate;
}

function toSavedSearch(row: SavedSearchRow): SavedSearch {
  const savedSearch: SavedSearch = {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    entityType: row.entity_type,
    searchParams: row.search_params as Record<string, unknown>,
    isPublic: row.is_public,
    enableNotifications: row.enable_notifications,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    useCount: row.use_count,
  };

  if (row.description !== null) {
    savedSearch.description = row.description;
  }

  if (row.last_used_at !== null) {
    savedSearch.lastUsedAt = row.last_used_at;
  }

  return savedSearch;
}

async function cacheValue(
  key: string,
  ttlSeconds: number,
  payload: unknown,
): Promise<void> {
  await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
}

const CACHE_TTL = 600; // 10 minutes for saved searches

// Create a new saved search
export async function createSavedSearch(
  data: SavedSearchCreate,
): Promise<SavedSearch> {
  try {
    const savedSearchDelegate = getSavedSearchDelegate();
    const savedSearch = await savedSearchDelegate.create({
      data: {
        user_id: data.userId,
        name: data.name,
        description: data.description,
        entity_type: data.entityType,
        search_params: data.searchParams as Prisma.InputJsonValue,
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
      name: data.name,
    });

    // Clear cache for user's saved searches
    await clearUserSavedSearchCache(data.userId);

    return toSavedSearch(savedSearch);
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
  } = {},
): Promise<{ searches: SavedSearch[]; total: number }> {
  try {
    const { entityType, includePublic = false, page = 1, limit = 50 } = options;

    const cacheKey = `user_saved_searches:${userId}:${JSON.stringify(options)}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as { searches: SavedSearch[]; total: number };
    }

    const skip = (page - 1) * limit;
    const filters: Record<string, unknown>[] = [];

    if (entityType) {
      filters.push({ entity_type: entityType });
    }

    if (includePublic) {
      filters.push({ OR: [{ user_id: userId }, { is_public: true }] });
    } else {
      filters.push({ user_id: userId });
    }

    const where = filters.length > 1 ? { AND: filters } : filters[0];

    const savedSearchDelegate = getSavedSearchDelegate();
    const [savedSearches, total] = await Promise.all([
      savedSearchDelegate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updated_at: 'desc' }, { use_count: 'desc' }],
      }),
      savedSearchDelegate.count({ where }),
    ]);

    const formattedSearches = savedSearches.map(toSavedSearch);

    const result = { searches: formattedSearches, total };

    // Cache the result
    await cacheValue(cacheKey, CACHE_TTL, result);

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
export async function getSavedSearchById(
  id: string,
  userId?: string,
): Promise<SavedSearch | null> {
  try {
    const cacheKey = `saved_search:${id}:${userId || 'public'}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as SavedSearch;
    }

    const where = userId
      ? {
          id,
          OR: [{ user_id: userId }, { is_public: true }],
        }
      : { id, is_public: true };

    const savedSearchDelegate = getSavedSearchDelegate();
    const savedSearch = await savedSearchDelegate.findFirst({ where });

    if (!savedSearch) {
      return null;
    }

    const formattedSearch = toSavedSearch(savedSearch);

    // Cache the result
    await cacheValue(cacheKey, CACHE_TTL, formattedSearch);

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
  data: Partial<SavedSearchCreate>,
): Promise<SavedSearch> {
  try {
    const savedSearchDelegate = getSavedSearchDelegate();
    const existingSearch = await savedSearchDelegate.findFirst({
      where: { id, user_id: userId },
    });

    if (!existingSearch) {
      throw new Error('Saved search not found or access denied');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.name) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.entityType) {
      updateData.entity_type = data.entityType;
    }
    if (data.searchParams) {
      updateData.search_params = data.searchParams as Prisma.InputJsonValue;
    }
    if (data.isPublic !== undefined) {
      updateData.is_public = data.isPublic;
    }
    if (data.enableNotifications !== undefined) {
      updateData.enable_notifications = data.enableNotifications;
    }

    const updatedSearch = await savedSearchDelegate.update({
      where: { id },
      data: updateData,
    });

    logger.info('Saved search updated', {
      savedSearchId: id,
      userId,
      name: data.name,
    });

    // Clear cache
    await clearUserSavedSearchCache(userId);

    return toSavedSearch(updatedSearch);
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
export async function deleteSavedSearch(
  id: string,
  userId: string,
): Promise<void> {
  try {
    const savedSearchDelegate = getSavedSearchDelegate();
    const existingSearch = await savedSearchDelegate.findFirst({
      where: { id, user_id: userId },
    });

    if (!existingSearch) {
      throw new Error('Saved search not found or access denied');
    }

    await savedSearchDelegate.delete({
      where: { id },
    });

    logger.info('Saved search deleted', {
      savedSearchId: id,
      userId,
      name: existingSearch.name,
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
export async function recordSavedSearchUse(
  id: string,
  userId: string,
): Promise<void> {
  try {
    const savedSearchDelegate = getSavedSearchDelegate();
    await savedSearchDelegate.update({
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
export async function getPopularSavedSearches(
  limit = 10,
): Promise<SavedSearch[]> {
  try {
    const cacheKey = 'popular_saved_searches';
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as SavedSearch[];
    }

    const savedSearchDelegate = getSavedSearchDelegate();
    const popularSearches = await savedSearchDelegate.findMany({
      where: { is_public: true },
      orderBy: [{ use_count: 'desc' }, { updated_at: 'desc' }],
      take: limit,
    });

    const formattedSearches = popularSearches.map(toSavedSearch);

    // Cache for longer time since popular searches don't change frequently
    await cacheValue(cacheKey, CACHE_TTL * 2, formattedSearches);

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
      await Promise.all(keys.map(key => redis.del(key)));
    }
  } catch (error) {
    logger.error('Error clearing user saved search cache', {
      error: (error as Error).message,
      userId,
    });
  }
}

// Get saved searches that match new items for notifications
export async function getSavedSearchesForNotifications(
  entityType: string,
): Promise<SavedSearch[]> {
  try {
    const savedSearchDelegate = getSavedSearchDelegate();
    const searches = await savedSearchDelegate.findMany({
      where: {
        entity_type: entityType,
        enable_notifications: true,
        is_public: true,
      },
      orderBy: { use_count: 'desc' },
    });

    return searches.map(toSavedSearch);
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
