import enhancedRedis from '@/config/redis';
import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';

// Redis client for caching analytics data
const redis = enhancedRedis.getClient();

const CACHE_TTL = 300; // 5 minutes for analytics

interface SearchAnalytics {
  totalSearches: number;
  averageResponseTime: number;
  popularSearchTerms: Array<{
    term: string;
    count: number;
    entityType: string;
  }>;
  searchTrends: Array<{
    date: string;
    count: number;
    entityType: string;
  }>;
  failedSearches: number;
  cacheHitRate: number;
  entityBreakdown: Array<{
    entityType: string;
    count: number;
    percentage: number;
  }>;
}

interface SearchMetrics {
  searchId: string;
  userId?: string;
  entityType: string;
  query: string;
  filters: Record<string, unknown>;
  resultCount: number;
  responseTime: number;
  cacheHit: boolean;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

// Record search metrics
export async function recordSearchMetrics(
  metrics: SearchMetrics,
): Promise<void> {
  try {
    // Store in Redis for real-time analytics
    const analyticsKey = `search_analytics:${new Date().toISOString().split('T')[0]}`;
    await redis.lpush(analyticsKey, JSON.stringify(metrics));
    await redis.expire(analyticsKey, 7 * 24 * 60 * 60); // Keep for 7 days

    // Update popular search terms
    if (metrics.query) {
      const termKey = `popular_terms:${metrics.entityType}`;
      await redis.zincrby(termKey, 1, metrics.query.toLowerCase());
      await redis.expire(termKey, 30 * 24 * 60 * 60); // Keep for 30 days
    }

    // Update daily search counts
    const dailyKey = `daily_searches:${new Date().toISOString().split('T')[0]}`;
    await redis.incr(dailyKey);
    await redis.expire(dailyKey, 30 * 24 * 60 * 60);

    // Update entity type counts
    const entityKey = `entity_searches:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(entityKey, metrics.entityType, 1);
    await redis.expire(entityKey, 30 * 24 * 60 * 60);

    logger.debug('Search metrics recorded', {
      searchId: metrics.searchId,
      entityType: metrics.entityType,
      responseTime: metrics.responseTime,
      cacheHit: metrics.cacheHit,
    });
  } catch (error) {
    logger.error('Error recording search metrics', {
      error: (error as Error).message,
      metrics,
    });
    // Don't throw error for analytics recording
  }
}

// Get comprehensive search analytics
export async function getSearchAnalytics(days = 30): Promise<SearchAnalytics> {
  try {
    const cacheKey = `search_analytics:${days}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const analytics: SearchAnalytics = {
      totalSearches: 0,
      averageResponseTime: 0,
      popularSearchTerms: [],
      searchTrends: [],
      failedSearches: 0,
      cacheHitRate: 0,
      entityBreakdown: [],
    };

    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000,
    );

    // Collect data for each day
    let totalResponseTime = 0;
    let totalSearches = 0;
    let cacheHits = 0;
    const entityCounts: Record<string, number> = {};
    const dailyData: Array<{
      date: string;
      count: number;
      entityType: string;
    }> = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const [isoDatePart] = date.toISOString().split('T');
      const dateStr = isoDatePart ?? date.toISOString();
      const analyticsKey = `search_analytics:${dateStr}`;

      try {
        const metrics = await redis.lrange(analyticsKey, 0, -1);

        if (metrics.length > 0) {
          const dayMetrics = metrics.map(m => JSON.parse(m));

          dayMetrics.forEach((metric: SearchMetrics) => {
            totalSearches++;
            totalResponseTime += metric.responseTime;

            if (metric.cacheHit) {
              cacheHits++;
            }

            if (metric.entityType) {
              entityCounts[metric.entityType] =
                (entityCounts[metric.entityType] || 0) + 1;
            }
          });
        }

        // Get daily counts
        const dailyCount = await redis.get(`daily_searches:${dateStr}`);
        if (dailyCount) {
          // Get entity breakdown for this day
          const entityKey = `entity_searches:${dateStr}`;
          const dayEntityCounts = await redis.hgetall(entityKey);

          Object.entries(dayEntityCounts).forEach(([entityType, count]) => {
            dailyData.push({
              date: dateStr,
              count: parseInt(count),
              entityType,
            });
          });
        }
      } catch (error) {
        logger.warn(`Failed to get analytics for ${dateStr}`, {
          error: (error as Error).message,
        });
      }
    }

    // Calculate overall metrics
    analytics.totalSearches = totalSearches;
    analytics.averageResponseTime =
      totalSearches > 0 ? totalResponseTime / totalSearches : 0;
    analytics.cacheHitRate =
      totalSearches > 0 ? (cacheHits / totalSearches) * 100 : 0;

    // Get popular search terms for each entity type
    const entityTypes = ['books', 'students', 'equipment', 'global'];
    const popularTerms: Array<{
      term: string;
      count: number;
      entityType: string;
    }> = [];

    for (const entityType of entityTypes) {
      try {
        const terms = await redis.zrevrange(
          `popular_terms:${entityType}`,
          0,
          9,
          'WITHSCORES',
        );

        for (let i = 0; i < terms.length; i += 2) {
          const term = terms[i];
          const score = terms[i + 1];

          if (typeof term === 'undefined' || typeof score === 'undefined') {
            continue;
          }

          const count = Number.parseInt(score, 10);
          if (Number.isNaN(count)) {
            continue;
          }

          popularTerms.push({
            term,
            count,
            entityType,
          });
        }
      } catch (error) {
        logger.warn(`Failed to get popular terms for ${entityType}`, {
          error: (error as Error).message,
        });
      }
    }

    analytics.popularSearchTerms = popularTerms
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Prepare search trends
    analytics.searchTrends = dailyData;

    // Prepare entity breakdown
    const totalEntities = Object.values(entityCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    analytics.entityBreakdown = Object.entries(entityCounts)
      .map(([entityType, count]) => ({
        entityType,
        count,
        percentage: totalEntities > 0 ? (count / totalEntities) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Cache the result
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(analytics));

    return analytics;
  } catch (error) {
    logger.error('Error getting search analytics', {
      error: (error as Error).message,
      days,
    });
    throw error;
  }
}

// Get search performance metrics
export async function getSearchPerformanceMetrics(): Promise<{
  averageResponseTime: number;
  slowestQueries: Array<{
    query: string;
    responseTime: number;
    timestamp: string;
  }>;
  fastestQueries: Array<{
    query: string;
    responseTime: number;
    timestamp: string;
  }>;
  cacheHitRate: number;
  errorRate: number;
}> {
  try {
    const cacheKey = 'search_performance_metrics';
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const metrics = {
      averageResponseTime: 0,
      slowestQueries: [] as Array<{
        query: string;
        responseTime: number;
        timestamp: string;
      }>,
      fastestQueries: [] as Array<{
        query: string;
        responseTime: number;
        timestamp: string;
      }>,
      cacheHitRate: 0,
      errorRate: 0,
    };

    // Get recent search metrics from the last 24 hours
    const today = new Date().toISOString().split('T')[0];
    const analyticsKey = `search_analytics:${today}`;
    const dayMetrics = await redis.lrange(analyticsKey, 0, -1);

    if (dayMetrics.length > 0) {
      const parsedMetrics = dayMetrics.map(m => JSON.parse(m));
      let totalResponseTime = 0;
      let cacheHits = 0;
      const allQueries: Array<{
        query: string;
        responseTime: number;
        timestamp: string;
      }> = [];

      parsedMetrics.forEach((metric: SearchMetrics) => {
        totalResponseTime += metric.responseTime;

        if (metric.cacheHit) {
          cacheHits++;
        }

        if (metric.query) {
          const timestampValue =
            metric.timestamp instanceof Date
              ? metric.timestamp.toISOString()
              : String(metric.timestamp);

          allQueries.push({
            query: metric.query,
            responseTime: metric.responseTime,
            timestamp: timestampValue,
          });
        }
      });

      metrics.averageResponseTime = totalResponseTime / parsedMetrics.length;
      metrics.cacheHitRate = (cacheHits / parsedMetrics.length) * 100;

      // Sort queries by response time
      allQueries.sort((a, b) => b.responseTime - a.responseTime);
      metrics.slowestQueries = allQueries.slice(0, 10);

      allQueries.sort((a, b) => a.responseTime - b.responseTime);
      metrics.fastestQueries = allQueries.slice(0, 10);
    }

    // Cache the result
    await redis.setex(cacheKey, CACHE_TTL / 2, JSON.stringify(metrics));

    return metrics;
  } catch (error) {
    logger.error('Error getting search performance metrics', {
      error: (error as Error).message,
    });
    throw error;
  }
}

type SavedSearchSummary = {
  name: string;
  use_count: number;
};

type SavedSearchDelegate = {
  findMany: (args: {
    where: { user_id: string };
    orderBy: { use_count: 'desc' };
    take: number;
  }) => Promise<SavedSearchSummary[]>;
};

// Get user search behavior analytics
export async function getUserSearchBehavior(
  userId?: string,
  days = 30,
): Promise<{
  totalSearches: number;
  averageSearchesPerDay: number;
  mostSearchedEntities: Array<{ entityType: string; count: number }>;
  favoriteSearchTerms: Array<{ term: string; count: number }>;
  searchActivityPattern: Array<{ hour: number; count: number }>;
  topSavedSearches: Array<{ name: string; useCount: number }>;
}> {
  try {
    const cacheKey = `user_search_behavior:${userId || 'all'}:${days}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const initialActivityPattern = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
    }));

    const behavior = {
      totalSearches: 0,
      averageSearchesPerDay: 0,
      mostSearchedEntities: [] as Array<{ entityType: string; count: number }>,
      favoriteSearchTerms: [] as Array<{ term: string; count: number }>,
      searchActivityPattern: initialActivityPattern,
      topSavedSearches: [] as Array<{ name: string; useCount: number }>,
    };

    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000,
    );

    // Collect user-specific data if userId is provided
    if (userId) {
      try {
        // Get user's saved searches
        const savedSearchDelegate = (
          prisma as unknown as { saved_searches?: SavedSearchDelegate }
        ).saved_searches;

        if (savedSearchDelegate?.findMany) {
          const savedSearches = await savedSearchDelegate.findMany({
            where: { user_id: userId },
            orderBy: { use_count: 'desc' },
            take: 10,
          });

          behavior.topSavedSearches = savedSearches.map(
            ({ name, use_count }) => ({
              name,
              useCount: use_count,
            }),
          );
        } else {
          logger.warn('Saved search delegate unavailable for analytics', {
            userId,
          });
        }
      } catch (error) {
        logger.warn('Failed to get user saved searches', {
          error: (error as Error).message,
          userId,
        });
      }
    }

    // Analyze search patterns from analytics data
    let totalSearches = 0;
    const entityCounts: Record<string, number> = {};
    const termCounts: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const analyticsKey = `search_analytics:${dateStr}`;

      try {
        const metrics = await redis.lrange(analyticsKey, 0, -1);

        metrics.forEach(metricStr => {
          const metric = JSON.parse(metricStr);

          // Filter by userId if provided
          if (userId && metric.userId !== userId) {
            return;
          }

          totalSearches++;

          if (metric.entityType) {
            entityCounts[metric.entityType] =
              (entityCounts[metric.entityType] || 0) + 1;
          }

          if (metric.query) {
            const queryLower = metric.query.toLowerCase();
            termCounts[queryLower] = (termCounts[queryLower] || 0) + 1;
          }

          // Analyze hourly pattern
          if (metric.timestamp) {
            const hour = new Date(metric.timestamp).getHours();
            const existingPattern = behavior.searchActivityPattern.find(
              p => p.hour === hour,
            );
            if (existingPattern) {
              existingPattern.count++;
            }
          }
        });
      } catch (error) {
        logger.warn(`Failed to analyze search pattern for ${dateStr}`, {
          error: (error as Error).message,
        });
      }
    }

    behavior.totalSearches = totalSearches;
    behavior.averageSearchesPerDay = totalSearches / days;
    behavior.mostSearchedEntities = Object.entries(entityCounts)
      .map(([entityType, count]) => ({ entityType, count }))
      .sort((a, b) => b.count - a.count);

    behavior.favoriteSearchTerms = Object.entries(termCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cache the result
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(behavior));

    return behavior;
  } catch (error) {
    logger.error('Error getting user search behavior', {
      error: (error as Error).message,
      userId,
      days,
    });
    throw error;
  }
}

// Clear old analytics data (cleanup job)
export async function cleanupOldAnalyticsData(daysToKeep = 90): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0] ?? '';

    // Get all analytics keys
    const keys = await redis.keys('search_analytics:*');

    let deletedCount = 0;
    for (const key of keys) {
      const [, dateStr] = key.split(':');
      if (dateStr && cutoffDateStr && dateStr < cutoffDateStr) {
        await redis.del(key);
        deletedCount++;
      }
    }

    // Clean up old popular terms (keep for 30 days)
    const termKeys = await redis.keys('popular_terms:*');
    for (const key of termKeys) {
      await redis.expire(key, 30 * 24 * 60 * 60);
    }

    // Clean up old daily counts (keep for 30 days)
    const dailyKeys = await redis.keys('daily_searches:*');
    for (const key of dailyKeys) {
      await redis.expire(key, 30 * 24 * 60 * 60);
    }

    logger.info('Analytics cleanup completed', {
      deletedCount,
      keysProcessed: keys.length,
      daysToKeep,
    });
  } catch (error) {
    logger.error('Error cleaning up old analytics data', {
      error: (error as Error).message,
      daysToKeep,
    });
  }
}

export default {
  recordSearchMetrics,
  getSearchAnalytics,
  getSearchPerformanceMetrics,
  getUserSearchBehavior,
  cleanupOldAnalyticsData,
};
