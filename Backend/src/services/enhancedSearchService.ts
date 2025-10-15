import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import bcrypt from 'bcrypt';

// Redis client for caching search results
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});

export interface EnhancedSearchOptions {
  query?: string;
  category?: string;
  subcategory?: string;
  author?: string;
  publisher?: string;
  location?: string;
  availableOnly?: boolean;
  readingLevel?: string;
  grade?: string;
  sortBy?: 'title' | 'author' | 'category' | 'popularity' | 'newest' | 'available';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  includeCovers?: boolean;
}

export interface SearchSuggestionOptions {
  query?: string;
  limit?: number;
  type?: 'title' | 'author' | 'category' | 'all';
}

export interface RecommendationOptions {
  bookId?: string;
  category?: string;
  author?: string;
  limit?: number;
  excludeCheckedOut?: boolean;
}

// Student Search Interfaces
export interface StudentSearchOptions {
  query?: string;
  gradeCategory?: string;
  gradeLevel?: string;
  isActive?: boolean;
  hasEquipmentBan?: boolean;
  hasFines?: boolean;
  activityType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'name' | 'gradeLevel' | 'lastActivity' | 'fineBalance' | 'checkoutCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface StudentSearchResult {
  students: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: StudentSearchOptions;
  sortBy: string;
  sortOrder: string;
}

// Equipment Search Interfaces
export interface EquipmentSearchOptions {
  query?: string;
  type?: string;
  status?: string;
  location?: string;
  category?: string;
  isAvailable?: boolean;
  requiresSupervision?: boolean;
  maintenanceDue?: boolean;
  conditionRating?: string;
  minUsageHours?: number;
  maxUsageHours?: number;
  sortBy?: 'name' | 'type' | 'status' | 'usageHours' | 'condition' | 'location';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface EquipmentSearchResult {
  equipment: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: EquipmentSearchOptions;
  sortBy: string;
  sortOrder: string;
}

// Global Search Interfaces
export interface GlobalSearchOptions {
  query?: string;
  entityType?: 'all' | 'books' | 'students' | 'equipment';
  limit?: number;
  page?: number;
}

export interface GlobalSearchResult {
  books: any[];
  students: any[];
  equipment: any[];
  total: number;
  query: string;
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

// Bulk Search Interfaces
export interface BulkSearchOptions {
  bookIds?: string[];
  studentIds?: string[];
  equipmentIds?: string[];
  isbns?: string[];
  accessionNumbers?: string[];
  studentNumbers?: string[];
  includeInactive?: boolean;
}

export interface BulkSearchResult {
  books: any[];
  students: any[];
  equipment: any[];
  notFound: {
    books: string[];
    students: string[];
    equipment: string[];
  };
}

// Saved Search Interfaces
export interface SavedSearchCreate {
  userId: string;
  name: string;
  description?: string;
  entityType: 'books' | 'students' | 'equipment' | 'global';
  searchParams: any;
  isPublic?: boolean;
  enableNotifications?: boolean;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  description?: string;
  entityType: string;
  searchParams: any;
  isPublic: boolean;
  enableNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  useCount: number;
}

// Cache search results for better performance
const CACHE_TTL = 300; // 5 minutes

function getCacheKey(options: EnhancedSearchOptions): string {
  const key = JSON.stringify(options);
  return `search:${Buffer.from(key).toString('base64')}`;
}

// Enhanced book search with advanced filtering
export async function searchBooks(options: EnhancedSearchOptions = {}) {
  try {
    const {
      query,
      category,
      subcategory,
      author,
      publisher,
      location,
      availableOnly = false,
      readingLevel,
      grade,
      sortBy = 'title',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
      includeCovers = true,
    } = options;

    const cacheKey = getCacheKey(options);

    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info('Search results retrieved from cache', { query, page });
      return JSON.parse(cached);
    }

    const skip = (page - 1) * limit;
    const where: Prisma.booksWhereInput = {};

    // Build search conditions
    if (query) {
      where.OR = [
        { title: { contains: query } },
        { author: { contains: query } },
        { publisher: { contains: query } },
        { category: { contains: query } },
        { subcategory: { contains: query } },
        { accession_no: { contains: query } },
        { isbn: { contains: query } },
      ];
    }

    if (category) {
      where.category = { contains: category };
    }

    if (subcategory) {
      where.subcategory = { contains: subcategory };
    }

    if (author) {
      where.author = { contains: author };
    }

    if (publisher) {
      where.publisher = { contains: publisher };
    }

    if (location) {
      where.location = { contains: location };
    }

    if (availableOnly) {
      where.available_copies = { gt: 0 };
    }

    // Filter by reading level (could be stored in subcategory or a dedicated field)
    if (readingLevel) {
      where.subcategory = {
        contains: readingLevel,
      };
    }

    // Determine sort order
    let orderBy: Prisma.booksOrderByWithRelationInput = {};

    switch (sortBy) {
      case 'author':
        orderBy = { author: sortOrder };
        break;
      case 'category':
        orderBy = { category: sortOrder };
        break;
      case 'popularity':
        // Sort by total copies (most popular first)
        orderBy = { total_copies: sortOrder === 'desc' ? 'desc' : 'asc' };
        break;
      case 'newest':
        orderBy = { created_at: sortOrder === 'desc' ? 'desc' : 'asc' };
        break;
      case 'available':
        orderBy = { available_copies: sortOrder === 'desc' ? 'desc' : 'asc' };
        break;
      case 'title':
      default:
        orderBy = { title: sortOrder };
        break;
    }

    const [books, total] = await Promise.all([
      prisma.books.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          book_checkouts: {
            where: { status: 'ACTIVE' },
            orderBy: { checkout_date: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.books.count({ where }),
    ]);

    // Enrich books with additional data
    const enrichedBooks = await Promise.all(
      books.map(async (book) => {
        let coverUrl = null;

        // Get book cover from Open Library API if requested
        if (includeCovers && book.isbn) {
          try {
            coverUrl = await getBookCover(book.isbn);
          } catch (error) {
            logger.warn('Failed to fetch book cover', {
              isbn: book.isbn,
              error: (error as Error).message
            });
          }
        }

        // Add popularity score based on checkout history
        const popularityScore = await calculatePopularityScore(book.id);

        return {
          ...book,
          coverUrl,
          popularityScore,
          isAvailable: book.available_copies > 0,
        };
      })
    );

    const result = {
      books: enrichedBooks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: {
        query,
        category,
        subcategory,
        author,
        publisher,
        location,
        availableOnly,
        readingLevel,
      },
      sortBy,
      sortOrder,
    };

    // Cache the results
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

    logger.info('Enhanced search completed', {
      query,
      total,
      page,
      took: Date.now(),
    });

    return result;
  } catch (error) {
    logger.error('Error in enhanced book search', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Get search suggestions/autocomplete
export async function getSearchSuggestions(options: SearchSuggestionOptions = {}) {
  try {
    const { query, limit = 10, type = 'all' } = options;

    if (!query || query.length < 2) {
      return { titles: [], authors: [], categories: [] };
    }

    const cacheKey = `suggestions:${type}:${query}:${limit}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const suggestions = {
      titles: [] as string[],
      authors: [] as string[],
      categories: [] as string[],
    };

    if (type === 'all' || type === 'title') {
      const titles = await prisma.books.findMany({
        where: {
          title: { contains: query },
        },
        select: { title: true },
        distinct: ['title'],
        orderBy: { title: 'asc' },
        take: limit,
      });
      suggestions.titles = titles.map(t => t.title);
    }

    if (type === 'all' || type === 'author') {
      const authors = await prisma.books.findMany({
        where: {
          author: { contains: query },
        },
        select: { author: true },
        distinct: ['author'],
        orderBy: { author: 'asc' },
        take: limit,
      });
      suggestions.authors = authors.map(a => a.author);
    }

    if (type === 'all' || type === 'category') {
      const categories = await prisma.books.findMany({
        where: {
          category: { contains: query },
        },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
        take: limit,
      });
      suggestions.categories = categories.map(c => c.category);
    }

    // Cache for shorter time since suggestions change frequently
    await redis.setex(cacheKey, 60, JSON.stringify(suggestions));

    return suggestions;
  } catch (error) {
    logger.error('Error getting search suggestions', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Get book recommendations based on various criteria
export async function getBookRecommendations(options: RecommendationOptions = {}) {
  try {
    const {
      bookId,
      category,
      author,
      limit = 8,
      excludeCheckedOut = false,
    } = options;

    let baseBook = null;

    // If bookId is provided, get the book to base recommendations on
    if (bookId) {
      baseBook = await prisma.books.findUnique({
        where: { id: bookId },
      });
    }

    const where: Prisma.booksWhereInput = {};

    // Don't include the original book in recommendations
    if (bookId) {
      where.id = { not: bookId };
    }

    // Prioritize books from the same category
    if (category || (baseBook && baseBook.category)) {
      where.category = category || baseBook.category;
    } else if (baseBook) {
      // Fallback to same category as base book
      where.category = baseBook.category;
    }

    // Also consider books by the same author
    const authorFilter = author || (baseBook && baseBook.author);

    // Only show available books if requested
    if (excludeCheckedOut) {
      where.available_copies = { gt: 0 };
    }

    // Get recommendations from same category
    const categoryRecommendations = await prisma.books.findMany({
      where,
      take: Math.ceil(limit * 0.7), // 70% from same category
      orderBy: [
        { available_copies: 'desc' },
        { total_copies: 'desc' },
        { title: 'asc' },
      ],
      include: {
        book_checkouts: {
          where: { status: 'ACTIVE' },
          orderBy: { checkout_date: 'desc' },
          take: 1,
        },
      },
    });

    let recommendations = [...categoryRecommendations];

    // If we have author filter and need more recommendations
    if (authorFilter && recommendations.length < limit) {
      const authorWhere: Prisma.booksWhereInput = {
        author: { contains: authorFilter },
        ...(bookId && { id: { not: bookId } }),
        ...(excludeCheckedOut && { available_copies: { gt: 0 } }),
      };

      const authorRecommendations = await prisma.books.findMany({
        where: authorWhere,
        take: limit - recommendations.length,
        orderBy: [
          { available_copies: 'desc' },
          { total_copies: 'desc' },
          { title: 'asc' },
        ],
        include: {
          book_checkouts: {
            where: { status: 'ACTIVE' },
            orderBy: { checkout_date: 'desc' },
            take: 1,
          },
        },
      });

      recommendations = [...recommendations, ...authorRecommendations];
    }

    // If still need more, get popular books
    if (recommendations.length < limit) {
      const popularWhere: Prisma.booksWhereInput = {
        ...(bookId && { id: { not: bookId } }),
        ...(excludeCheckedOut && { available_copies: { gt: 0 } }),
      };

      const popularRecommendations = await prisma.books.findMany({
        where: popularWhere,
        take: limit - recommendations.length,
        orderBy: [
          { total_copies: 'desc' },
          { available_copies: 'desc' },
          { title: 'asc' },
        ],
        include: {
          book_checkouts: {
            where: { status: 'ACTIVE' },
            orderBy: { checkout_date: 'desc' },
            take: 1,
          },
        },
      });

      recommendations = [...recommendations, ...popularRecommendations];
    }

    // Add cover URLs and enrichment
    const enrichedRecommendations = await Promise.all(
      recommendations.map(async (book) => {
        let coverUrl = null;

        if (book.isbn) {
          try {
            coverUrl = await getBookCover(book.isbn);
          } catch (error) {
            logger.warn('Failed to fetch book cover for recommendation', {
              isbn: book.isbn
            });
          }
        }

        const popularityScore = await calculatePopularityScore(book.id);

        return {
          ...book,
          coverUrl,
          popularityScore,
          isAvailable: book.available_copies > 0,
          recommendationReason: determineRecommendationReason(book, baseBook, authorFilter),
        };
      })
    );

    return enrichedRecommendations.slice(0, limit);
  } catch (error) {
    logger.error('Error getting book recommendations', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Helper function to get book cover from Open Library API
async function getBookCover(isbn: string): Promise<string | null> {
  try {
    // Remove any hyphens from ISBN for API call
    const cleanIsbn = isbn.replace(/[-\s]/g, '');

    // Try to get cover from Open Library API
    const coverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg`;

    // Check if cover exists by making a HEAD request
    const response = await fetch(coverUrl, { method: 'HEAD' });

    if (response.ok) {
      return coverUrl;
    }

    return null;
  } catch (error) {
    logger.warn('Error fetching book cover', { isbn, error: (error as Error).message });
    return null;
  }
}

// Calculate popularity score based on checkout history
async function calculatePopularityScore(bookId: string): Promise<number> {
  try {
    const checkoutCount = await prisma.book_checkouts.count({
      where: { book_id: bookId },
    });

    const book = await prisma.books.findUnique({
      where: { id: bookId },
      select: { total_copies: true, available_copies: true },
    });

    if (!book) return 0;

    // Score based on checkout frequency and availability
    const checkoutFrequency = checkoutCount / (book.total_copies || 1);
    const availabilityScore = book.available_copies / (book.total_copies || 1);

    return Math.round((checkoutFrequency * 0.7 + availabilityScore * 0.3) * 100);
  } catch (error) {
    logger.warn('Error calculating popularity score', { bookId, error: (error as Error).message });
    return 0;
  }
}

// Determine why a book was recommended
function determineRecommendationReason(
  book: any,
  baseBook: any,
  authorFilter?: string
): string {
  if (authorFilter && book.author.toLowerCase().includes(authorFilter.toLowerCase())) {
    return 'Same author';
  }

  if (baseBook && book.category === baseBook.category) {
    return 'Similar category';
  }

  if (book.total_copies > 5) {
    return 'Popular choice';
  }

  return 'Recommended';
}

// Get recent searches for a user (if user tracking is implemented)
export async function getRecentSearches(userId?: string, limit = 10): Promise<string[]> {
  // This would typically be stored in a user-specific table or Redis
  // For now, return empty array - would need user session tracking
  return [];
}

// Enhanced Student Search with Advanced Filtering
export async function searchStudents(options: StudentSearchOptions = {}): Promise<StudentSearchResult> {
  try {
    const {
      query,
      gradeCategory,
      gradeLevel,
      isActive,
      hasEquipmentBan,
      hasFines,
      activityType,
      dateFrom,
      dateTo,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
    } = options;

    const cacheKey = `student_search:${JSON.stringify(options)}`;

    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info('Student search results retrieved from cache', { query, page });
      return JSON.parse(cached);
    }

    const skip = (page - 1) * limit;
    const where: Prisma.studentsWhereInput = {};

    // Build search conditions
    if (query) {
      where.OR = [
        { first_name: { contains: query } },
        { last_name: { contains: query } },
        { student_id: { contains: query } },
        { section: { contains: query } },
      ];
    }

    if (gradeCategory) {
      where.grade_category = gradeCategory as any;
    }

    if (gradeLevel) {
      where.grade_level = { contains: gradeLevel };
    }

    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    if (hasEquipmentBan !== undefined) {
      where.equipment_ban = hasEquipmentBan;
    }

    if (hasFines !== undefined) {
      where.fine_balance = hasFines ? { gt: 0 } : { lte: 0 };
    }

    // Activity-based filtering
    let activityWhere: Prisma.student_activitiesWhereInput = {};
    if (activityType) {
      activityWhere.activity_type = activityType as any;
    }
    if (dateFrom || dateTo) {
      activityWhere.start_time = {};
      if (dateFrom) activityWhere.start_time.gte = new Date(dateFrom);
      if (dateTo) activityWhere.start_time.lte = new Date(dateTo);
    }

    // Determine sort order
    let orderBy: Prisma.studentsOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'name':
        orderBy = { last_name: sortOrder, first_name: sortOrder };
        break;
      case 'gradeLevel':
        orderBy = { grade_category: sortOrder, grade_level: sortOrder };
        break;
      case 'fineBalance':
        orderBy = { fine_balance: sortOrder === 'desc' ? 'desc' : 'asc' };
        break;
      case 'checkoutCount':
        // This would require aggregation - simplified for now
        orderBy = { last_name: sortOrder };
        break;
      case 'lastActivity':
        // This would require joining with activities - simplified for now
        orderBy = { updated_at: sortOrder === 'desc' ? 'desc' : 'asc' };
        break;
      default:
        orderBy = { last_name: sortOrder, first_name: sortOrder };
        break;
    }

    const [students, total] = await Promise.all([
      prisma.students.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          student_activities: activityType || dateFrom || dateTo ? {
            where: activityWhere,
            orderBy: { start_time: 'desc' },
            take: 1,
          } : false,
          book_checkouts: {
            where: { status: 'ACTIVE' },
            orderBy: { checkout_date: 'desc' },
            take: 1,
          },
          equipment_sessions: {
            where: { status: 'ACTIVE' },
            orderBy: { session_start: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.students.count({ where }),
    ]);

    // Enrich students with additional data
    const enrichedStudents = await Promise.all(
      students.map(async (student) => {
        // Calculate checkout statistics
        const checkoutStats = await prisma.book_checkouts.groupBy({
          by: ['status'],
          where: { student_id: student.id },
          _count: { status: true },
        });

        const activeCheckouts = checkoutStats.find(s => s.status === 'ACTIVE')?._count.status || 0;
        const overdueCheckouts = checkoutStats.find(s => s.status === 'OVERDUE')?._count.status || 0;

        // Calculate activity statistics
        const activityStats = await prisma.student_activities.groupBy({
          by: ['activity_type'],
          where: {
            student_id: student.id,
            start_time: dateFrom || dateTo ? {
              gte: dateFrom ? new Date(dateFrom) : undefined,
              lte: dateTo ? new Date(dateTo) : undefined,
            } : undefined,
          },
          _count: { activity_type: true },
        });

        const lastActivity = student.student_activities?.[0];
        const lastCheckout = student.book_checkouts?.[0];
        const currentSession = student.equipment_sessions?.[0];

        return {
          ...student,
          // Add computed fields
          fullName: `${student.first_name} ${student.last_name}`,
          activeCheckouts,
          overdueCheckouts,
          totalActivities: activityStats.reduce((sum, stat) => sum + stat._count.activity_type, 0),
          lastActivityDate: lastActivity?.start_time,
          lastCheckoutDate: lastCheckout?.checkout_date,
          currentEquipmentSession: currentSession,
          hasOverdueItems: overdueCheckouts > 0,
          equipmentBanStatus: student.equipment_ban ? {
            isBanned: true,
            reason: student.equipment_ban_reason,
            until: student.equipment_ban_until,
          } : {
            isBanned: false,
          },
        };
      })
    );

    const result: StudentSearchResult = {
      students: enrichedStudents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: options,
      sortBy,
      sortOrder,
    };

    // Cache the results
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

    logger.info('Enhanced student search completed', {
      query,
      total,
      page,
      took: Date.now(),
    });

    return result;
  } catch (error) {
    logger.error('Error in enhanced student search', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Enhanced Equipment Search with Advanced Filtering
export async function searchEquipment(options: EquipmentSearchOptions = {}): Promise<EquipmentSearchResult> {
  try {
    const {
      query,
      type,
      status,
      location,
      category,
      isAvailable,
      requiresSupervision,
      maintenanceDue,
      conditionRating,
      minUsageHours,
      maxUsageHours,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
    } = options;

    const cacheKey = `equipment_search:${JSON.stringify(options)}`;

    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info('Equipment search results retrieved from cache', { query, page });
      return JSON.parse(cached);
    }

    const skip = (page - 1) * limit;
    const where: Prisma.equipmentWhereInput = {};

    // Build search conditions
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { equipment_id: { contains: query } },
        { description: { contains: query } },
        { location: { contains: query } },
        { category: { contains: query } },
      ];
    }

    if (type) {
      where.type = type as any;
    }

    if (status) {
      where.status = status as any;
    }

    if (location) {
      where.location = { contains: location };
    }

    if (category) {
      where.category = { contains: category };
    }

    if (isAvailable !== undefined) {
      where.status = isAvailable ? 'AVAILABLE' : { not: 'AVAILABLE' };
    }

    if (requiresSupervision !== undefined) {
      where.requires_supervision = requiresSupervision;
    }

    if (maintenanceDue !== undefined) {
      if (maintenanceDue) {
        where.next_maintenance = { lte: new Date() };
      } else {
        where.next_maintenance = { gt: new Date() };
      }
    }

    if (conditionRating) {
      where.condition_rating = conditionRating as any;
    }

    if (minUsageHours !== undefined || maxUsageHours !== undefined) {
      where.total_usage_hours = {};
      if (minUsageHours !== undefined) where.total_usage_hours.gte = minUsageHours;
      if (maxUsageHours !== undefined) where.total_usage_hours.lte = maxUsageHours;
    }

    where.is_active = true; // Only show active equipment

    // Determine sort order
    let orderBy: Prisma.equipmentOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'name':
        orderBy = { name: sortOrder };
        break;
      case 'type':
        orderBy = { type: sortOrder };
        break;
      case 'status':
        orderBy = { status: sortOrder };
        break;
      case 'usageHours':
        orderBy = { total_usage_hours: sortOrder === 'desc' ? 'desc' : 'asc' };
        break;
      case 'condition':
        orderBy = { condition_rating: sortOrder };
        break;
      case 'location':
        orderBy = { location: sortOrder };
        break;
      default:
        orderBy = { name: sortOrder };
        break;
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          equipment_sessions: {
            where: { status: 'ACTIVE' },
            orderBy: { session_start: 'desc' },
            take: 1,
          },
          equipment_reservations: {
            where: {
              status: { in: ['PENDING', 'CONFIRMED'] },
              start_time: { gte: new Date() }
            },
            orderBy: { start_time: 'asc' },
            take: 1,
          },
          equipment_maintenance: {
            where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
            orderBy: { scheduled_date: 'asc' },
            take: 1,
          },
        },
      }),
      prisma.equipment.count({ where }),
    ]);

    // Enrich equipment with additional data
    const enrichedEquipment = await Promise.all(
      equipment.map(async (equip) => {
        const currentSession = equip.equipment_sessions?.[0];
        const upcomingReservation = equip.equipment_reservations?.[0];
        const pendingMaintenance = equip.equipment_maintenance?.[0];

        // Calculate utilization rate
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const recentUsage = await prisma.equipment_sessions.aggregate({
          where: {
            equipment_id: equip.id,
            session_start: { gte: thirtyDaysAgo },
            status: 'COMPLETED',
          },
          _sum: { actual_duration: true },
          _count: { id: true },
        });

        const utilizationRate = equip.max_time_minutes > 0
          ? (recentUsage._sum.actual_duration || 0) / (30 * equip.max_time_minutes) * 100
          : 0;

        return {
          ...equip,
          // Add computed fields
          currentSession,
          upcomingReservation,
          pendingMaintenance,
          utilizationRate: Math.min(utilizationRate, 100),
          recentUsageStats: {
            totalSessions: recentUsage._count.id,
            totalMinutes: recentUsage._sum.actual_duration || 0,
          },
          availabilityStatus: equip.status === 'AVAILABLE' && !currentSession ? 'Available' :
                               equip.status === 'IN_USE' || currentSession ? 'In Use' :
                               equip.status === 'MAINTENANCE' ? 'Maintenance' :
                               equip.status,
          isReservationRequired: upcomingReservation ? true : false,
          nextAvailableDate: currentSession?.session_end || upcomingReservation?.end_time,
        };
      })
    );

    const result: EquipmentSearchResult = {
      equipment: enrichedEquipment,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: options,
      sortBy,
      sortOrder,
    };

    // Cache the results
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

    logger.info('Enhanced equipment search completed', {
      query,
      total,
      page,
      took: Date.now(),
    });

    return result;
  } catch (error) {
    logger.error('Error in enhanced equipment search', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Global Search across all entities
export async function globalSearch(options: GlobalSearchOptions = {}): Promise<GlobalSearchResult> {
  try {
    const {
      query,
      entityType = 'all',
      limit = 10,
      page = 1,
    } = options;

    if (!query || query.length < 2) {
      return {
        books: [],
        students: [],
        equipment: [],
        total: 0,
        query,
        pagination: {
          page,
          limit,
          hasMore: false,
        },
      };
    }

    const cacheKey = `global_search:${JSON.stringify(options)}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      logger.info('Global search results retrieved from cache', { query, page });
      return JSON.parse(cached);
    }

    const results = {
      books: [] as any[],
      students: [] as any[],
      equipment: [] as any[],
    };

    const skip = (page - 1) * limit;

    // Search books
    if (entityType === 'all' || entityType === 'books') {
      const bookResults = await searchBooks({
        query,
        page,
        limit: entityType === 'books' ? limit : Math.ceil(limit / 3),
        includeCovers: false,
      });
      results.books = bookResults.books.map(book => ({
        ...book,
        entityType: 'book',
        relevanceScore: calculateRelevanceScore(query, [book.title, book.author, book.category]),
      }));
    }

    // Search students
    if (entityType === 'all' || entityType === 'students') {
      const studentResults = await searchStudents({
        query,
        page,
        limit: entityType === 'students' ? limit : Math.ceil(limit / 3),
      });
      results.students = studentResults.students.map(student => ({
        ...student,
        entityType: 'student',
        relevanceScore: calculateRelevanceScore(query, [student.fullName, student.student_id, student.grade_level]),
      }));
    }

    // Search equipment
    if (entityType === 'all' || entityType === 'equipment') {
      const equipmentResults = await searchEquipment({
        query,
        page,
        limit: entityType === 'equipment' ? limit : Math.ceil(limit / 3),
      });
      results.equipment = equipmentResults.equipment.map(equip => ({
        ...equip,
        entityType: 'equipment',
        relevanceScore: calculateRelevanceScore(query, [equip.name, equip.equipment_id, equip.type, equip.category]),
      }));
    }

    // Sort all results by relevance
    const allResults = [
      ...results.books,
      ...results.students,
      ...results.equipment,
    ].sort((a, b) => b.relevanceScore - a.relevanceScore);

    const total = allResults.length;
    const paginatedResults = allResults.slice(skip, skip + limit);

    // Separate back into entity types
    const finalResults = {
      books: paginatedResults.filter(r => r.entityType === 'book'),
      students: paginatedResults.filter(r => r.entityType === 'student'),
      equipment: paginatedResults.filter(r => r.entityType === 'equipment'),
    };

    const result: GlobalSearchResult = {
      ...finalResults,
      total,
      query,
      pagination: {
        page,
        limit,
        hasMore: skip + limit < total,
      },
    };

    // Cache for shorter time since global search changes frequently
    await redis.setex(cacheKey, 120, JSON.stringify(result));

    logger.info('Global search completed', {
      query,
      entityType,
      total,
      page,
      took: Date.now(),
    });

    return result;
  } catch (error) {
    logger.error('Error in global search', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Bulk Search for multiple items
export async function bulkSearch(options: BulkSearchOptions): Promise<BulkSearchResult> {
  try {
    const {
      bookIds,
      studentIds,
      equipmentIds,
      isbns,
      accessionNumbers,
      studentNumbers,
      includeInactive = false,
    } = options;

    const result: BulkSearchResult = {
      books: [],
      students: [],
      equipment: [],
      notFound: {
        books: [],
        students: [],
        equipment: [],
      },
    };

    // Search books
    const bookSearchConditions: Prisma.booksWhereInput = {
      is_active: includeInactive ? undefined : true,
    };

    if (bookIds?.length) {
      bookSearchConditions.id = { in: bookIds };
    }
    if (isbns?.length) {
      bookSearchConditions.isbn = { in: isbns };
    }
    if (accessionNumbers?.length) {
      bookSearchConditions.accession_no = { in: accessionNumbers };
    }

    if (bookIds?.length || isbns?.length || accessionNumbers?.length) {
      const books = await prisma.books.findMany({
        where: bookSearchConditions,
        include: {
          book_checkouts: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
        },
      });

      result.books = books;

      // Track not found items
      const foundBookIds = books.map(b => b.id);
      const foundIsbns = books.map(b => b.isbn).filter(Boolean);
      const foundAccessionNumbers = books.map(b => b.accession_no);

      if (bookIds) result.notFound.books.push(...bookIds.filter(id => !foundBookIds.includes(id)));
      if (isbns) result.notFound.books.push(...isbns.filter(isbn => !foundIsbns.includes(isbn)));
      if (accessionNumbers) result.notFound.books.push(...accessionNumbers.filter(acc => !foundAccessionNumbers.includes(acc)));
    }

    // Search students
    const studentSearchConditions: Prisma.studentsWhereInput = {
      is_active: includeInactive ? undefined : true,
    };

    if (studentIds?.length) {
      studentSearchConditions.id = { in: studentIds };
    }
    if (studentNumbers?.length) {
      studentSearchConditions.student_id = { in: studentNumbers };
    }

    if (studentIds?.length || studentNumbers?.length) {
      const students = await prisma.students.findMany({
        where: studentSearchConditions,
        include: {
          book_checkouts: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
          equipment_sessions: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
        },
      });

      result.students = students;

      // Track not found items
      const foundStudentIds = students.map(s => s.id);
      const foundStudentNumbers = students.map(s => s.student_id);

      if (studentIds) result.notFound.students.push(...studentIds.filter(id => !foundStudentIds.includes(id)));
      if (studentNumbers) result.notFound.students.push(...studentNumbers.filter(num => !foundStudentNumbers.includes(num)));
    }

    // Search equipment
    if (equipmentIds?.length) {
      const equipment = await prisma.equipment.findMany({
        where: {
          id: { in: equipmentIds },
          is_active: includeInactive ? undefined : true,
        },
        include: {
          equipment_sessions: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
          equipment_reservations: {
            where: { status: { in: ['PENDING', 'CONFIRMED'] } },
            take: 1,
          },
        },
      });

      result.equipment = equipment;

      // Track not found items
      const foundEquipmentIds = equipment.map(e => e.id);
      result.notFound.equipment.push(...equipmentIds.filter(id => !foundEquipmentIds.includes(id)));
    }

    logger.info('Bulk search completed', {
      booksFound: result.books.length,
      studentsFound: result.students.length,
      equipmentFound: result.equipment.length,
      totalNotFound: result.notFound.books.length + result.notFound.students.length + result.notFound.equipment.length,
    });

    return result;
  } catch (error) {
    logger.error('Error in bulk search', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Calculate relevance score for search results
function calculateRelevanceScore(query: string, fields: string[]): number {
  if (!query || !fields.length) return 0;

  const queryLower = query.toLowerCase();
  let score = 0;

  fields.forEach(field => {
    if (!field) return;

    const fieldLower = field.toLowerCase();

    // Exact match gets highest score
    if (fieldLower === queryLower) {
      score += 100;
    }
    // Starts with query gets high score
    else if (fieldLower.startsWith(queryLower)) {
      score += 80;
    }
    // Contains query gets medium score
    else if (fieldLower.includes(queryLower)) {
      score += 60;
    }

    // Word matching
    const queryWords = queryLower.split(' ');
    const fieldWords = fieldLower.split(' ');

    queryWords.forEach(queryWord => {
      fieldWords.forEach(fieldWord => {
        if (fieldWord === queryWord) {
          score += 40;
        } else if (fieldWord.includes(queryWord)) {
          score += 20;
        }
      });
    });
  });

  return Math.min(score, 100); // Cap at 100
}

// Save search query for user (if user tracking is implemented)
export async function saveSearchQuery(userId: string, query: string): Promise<void> {
  // This would save to a user search history table
  // Implementation depends on user authentication system
  logger.info('Search query saved', { userId, query });
}

export default {
  searchBooks,
  getSearchSuggestions,
  getBookRecommendations,
  getRecentSearches,
  saveSearchQuery,
  searchStudents,
  searchEquipment,
  globalSearch,
  bulkSearch,
};