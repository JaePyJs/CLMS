import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import {
  searchBooks,
  getSearchSuggestions,
  getBookRecommendations,
  saveSearchQuery,
  getRecentSearches,
  searchStudents,
  searchEquipment,
  globalSearch,
  bulkSearch,
} from '@/services/enhancedSearchService';
import savedSearchService from '@/services/savedSearchService';
import { logger } from '@/utils/logger';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';
import { auditMiddleware } from '@/middleware/ferpa.middleware';

const router = Router();

// Enhanced search endpoint with advanced filtering
router.get('/books', requirePermission(Permission.BOOKS_VIEW), async (req: Request, res: Response) => {
  try {
    const {
      query,
      category,
      subcategory,
      author,
      publisher,
      location,
      availableOnly,
      readingLevel,
      sortBy,
      sortOrder,
      page = '1',
      limit = '20',
      includeCovers = 'true',
    } = req.query;

    const searchOptions = {
      query: query as string,
      category: category as string,
      subcategory: subcategory as string,
      author: author as string,
      publisher: publisher as string,
      location: location as string,
      availableOnly: availableOnly === 'true',
      readingLevel: readingLevel as string,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      includeCovers: includeCovers === 'true',
    };

    const result = await searchBooks(searchOptions);

    // Save search query if user is authenticated (optional)
    if (query && (req as any).user?.id) {
      try {
        await saveSearchQuery((req as any).user.id, query as string);
      } catch (error) {
        logger.warn('Failed to save search query', { error: (error as Error).message });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error in enhanced book search', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get search suggestions/autocomplete
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { query, limit = '10', type = 'all' } = req.query;

    if (!query || (query as string).length < 2) {
      res.json({
        success: true,
        data: { titles: [], authors: [], categories: [] },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const suggestions = await getSearchSuggestions({
      query: query as string,
      limit: parseInt(limit as string),
      type: type as any,
    });

    const response: ApiResponse = {
      success: true,
      data: suggestions,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting search suggestions', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get book recommendations
router.get('/recommendations', requirePermission(Permission.BOOKS_VIEW), async (req: Request, res: Response) => {
  try {
    const { bookId, category, author, limit = '8', excludeCheckedOut = 'false' } = req.query;

    const recommendations = await getBookRecommendations({
      bookId: bookId as string,
      category: category as string,
      author: author as string,
      limit: parseInt(limit as string),
      excludeCheckedOut: excludeCheckedOut === 'true',
    });

    const response: ApiResponse = {
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting book recommendations', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get recent searches for authenticated user
router.get('/recent', requirePermission(Permission.BOOKS_VIEW), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { limit = '10' } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const recentSearches = await getRecentSearches(userId, parseInt(limit as string));

    const response: ApiResponse = {
      success: true,
      data: { searches: recentSearches },
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting recent searches', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Save search query (for authenticated users)
router.post('/save',
  auditMiddleware('SAVE_SEARCH'),
  requirePermission(Permission.BOOKS_VIEW),
  async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { query } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await saveSearchQuery(userId, query);

    const response: ApiResponse = {
      success: true,
      message: 'Search query saved successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error saving search query', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get popular books (based on checkout history and availability)
router.get('/popular', requirePermission(Permission.BOOKS_VIEW), async (req: Request, res: Response) => {
  try {
    const { limit = '10', category } = req.query;

    const popularBooks = await searchBooks({
      category: category as string,
      sortBy: 'popularity',
      sortOrder: 'desc',
      page: 1,
      limit: parseInt(limit as string),
      includeCovers: true,
    });

    const response: ApiResponse = {
      success: true,
      data: popularBooks.books,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting popular books', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get newly added books
router.get('/new', requirePermission(Permission.BOOKS_VIEW), async (req: Request, res: Response) => {
  try {
    const { limit = '10', category } = req.query;

    const newBooks = await searchBooks({
      category: category as string,
      sortBy: 'newest',
      sortOrder: 'desc',
      page: 1,
      limit: parseInt(limit as string),
      includeCovers: true,
    });

    const response: ApiResponse = {
      success: true,
      data: newBooks.books,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting new books', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get available books for quick checkout
router.get('/available', requirePermission(Permission.BOOKS_VIEW), async (req: Request, res: Response) => {
  try {
    const { limit = '20', category } = req.query;

    const availableBooks = await searchBooks({
      category: category as string,
      availableOnly: true,
      sortBy: 'title',
      sortOrder: 'asc',
      page: 1,
      limit: parseInt(limit as string),
      includeCovers: true,
    });

    const response: ApiResponse = {
      success: true,
      data: availableBooks.books,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting available books', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Advanced Student Search endpoint
router.get('/students',
  auditMiddleware('STUDENT_SEARCH'),
  requirePermission(Permission.STUDENTS_VIEW),
  async (req: Request, res: Response) => {
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
      sortBy,
      sortOrder,
      page = '1',
      limit = '20',
    } = req.query;

    const searchOptions = {
      query: query as string,
      gradeCategory: gradeCategory as string,
      gradeLevel: gradeLevel as string,
      isActive: isActive === 'true',
      hasEquipmentBan: hasEquipmentBan === 'true',
      hasFines: hasFines === 'true',
      activityType: activityType as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await searchStudents(searchOptions);

    // Save search query if user is authenticated (optional)
    if (query && (req as any).user?.id) {
      try {
        await saveSearchQuery((req as any).user.id, query as string);
      } catch (error) {
        logger.warn('Failed to save student search query', { error: (error as Error).message });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error in enhanced student search', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Advanced Equipment Search endpoint
router.get('/equipment', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
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
      sortBy,
      sortOrder,
      page = '1',
      limit = '20',
    } = req.query;

    const searchOptions = {
      query: query as string,
      type: type as string,
      status: status as string,
      location: location as string,
      category: category as string,
      isAvailable: isAvailable === 'true',
      requiresSupervision: requiresSupervision === 'true',
      maintenanceDue: maintenanceDue === 'true',
      conditionRating: conditionRating as string,
      minUsageHours: minUsageHours ? parseInt(minUsageHours as string) : undefined,
      maxUsageHours: maxUsageHours ? parseInt(maxUsageHours as string) : undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await searchEquipment(searchOptions);

    // Save search query if user is authenticated (optional)
    if (query && (req as any).user?.id) {
      try {
        await saveSearchQuery((req as any).user.id, query as string);
      } catch (error) {
        logger.warn('Failed to save equipment search query', { error: (error as Error).message });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error in enhanced equipment search', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Global Search across all entities
router.get('/global', async (req: Request, res: Response) => {
  try {
    const {
      query,
      entityType = 'all',
      page = '1',
      limit = '10',
    } = req.query;

    if (!query || (query as string).length < 2) {
      res.json({
        success: true,
        data: {
          books: [],
          students: [],
          equipment: [],
          total: 0,
          query,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            hasMore: false,
          },
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate at least one search parameter is provided
    if (!bookIds?.length && !studentIds?.length && !equipmentIds?.length &&
        !isbns?.length && !accessionNumbers?.length && !studentNumbers?.length) {
      res.status(400).json({
        success: false,
        error: 'At least one search parameter must be provided',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const searchOptions = {
      query: query as string,
      entityType: entityType as any,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await globalSearch(searchOptions);

    // Save search query if user is authenticated (optional)
    if (query && (req as any).user?.id) {
      try {
        await saveSearchQuery((req as any).user.id, query as string);
      } catch (error) {
        logger.warn('Failed to save global search query', { error: (error as Error).message });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error in global search', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Bulk Search for multiple items
router.post('/bulk', requirePermission(Permission.BOOKS_VIEW), async (req: Request, res: Response) => {
  try {
    const {
      bookIds,
      studentIds,
      equipmentIds,
      isbns,
      accessionNumbers,
      studentNumbers,
      includeInactive = false,
    } = req.body;

    // Validate at least one search parameter is provided
    if (!bookIds?.length && !studentIds?.length && !equipmentIds?.length &&
        !isbns?.length && !accessionNumbers?.length && !studentNumbers?.length) {
      res.status(400).json({
        success: false,
        error: 'At least one search parameter must be provided',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const searchOptions = {
      bookIds,
      studentIds,
      equipmentIds,
      isbns,
      accessionNumbers,
      studentNumbers,
      includeInactive,
    };

    const result = await bulkSearch(searchOptions);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error in bulk search', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get search suggestions for students
router.get('/students/suggestions', async (req: Request, res: Response) => {
  try {
    const { query, limit = '10' } = req.query;

    if (!query || (query as string).length < 2) {
      res.json({
        success: true,
        data: { names: [], studentIds: [], grades: [] },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Use student search with minimal filters to get suggestions
    const suggestions = await searchStudents({
      query: query as string,
      limit: parseInt(limit as string),
      page: 1,
    });

    const uniqueNames = [...new Set(suggestions.students.map(s => `${s.first_name} ${s.last_name}`))];
    const uniqueStudentIds = [...new Set(suggestions.students.map(s => s.student_id).filter(Boolean))];
    const uniqueGrades = [...new Set(suggestions.students.map(s => s.grade_level).filter(Boolean))];

    const response: ApiResponse = {
      success: true,
      data: {
        names: uniqueNames.slice(0, 5),
        studentIds: uniqueStudentIds.slice(0, 5),
        grades: uniqueGrades.slice(0, 5),
      },
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting student search suggestions', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get search suggestions for equipment
router.get('/equipment/suggestions', async (req: Request, res: Response) => {
  try {
    const { query, limit = '10' } = req.query;

    if (!query || (query as string).length < 2) {
      res.json({
        success: true,
        data: { names: [], types: [], locations: [] },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Use equipment search with minimal filters to get suggestions
    const suggestions = await searchEquipment({
      query: query as string,
      limit: parseInt(limit as string),
      page: 1,
    });

    const uniqueNames = [...new Set(suggestions.equipment.map(e => e.name))];
    const uniqueTypes = [...new Set(suggestions.equipment.map(e => e.type).filter(Boolean))];
    const uniqueLocations = [...new Set(suggestions.equipment.map(e => e.location).filter(Boolean))];

    const response: ApiResponse = {
      success: true,
      data: {
        names: uniqueNames.slice(0, 5),
        types: uniqueTypes.slice(0, 5),
        locations: uniqueLocations.slice(0, 5),
      },
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting equipment search suggestions', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Saved Searches Routes

// Create a new saved search
router.post('/saved',
  auditMiddleware('CREATE_SAVED_SEARCH'),
  requirePermission(Permission.BOOKS_VIEW),
  async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { name, description, entityType, searchParams, isPublic, enableNotifications } = req.body;

    if (!name || !entityType || !searchParams) {
      res.status(400).json({
        success: false,
        error: 'Name, entityType, and searchParams are required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const savedSearch = await savedSearchService.createSavedSearch({
      userId,
      name,
      description,
      entityType,
      searchParams,
      isPublic,
      enableNotifications,
    });

    const response: ApiResponse = {
      success: true,
      data: savedSearch,
      message: 'Saved search created successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error creating saved search', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get user's saved searches
router.get('/saved',
  requirePermission(Permission.BOOKS_VIEW),
  async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { entityType, includePublic, page = '1', limit = '50' } = req.query;

    const result = await savedSearchService.getUserSavedSearches(userId, {
      entityType: entityType as string,
      includePublic: includePublic === 'true',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting saved searches', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get a specific saved search
router.get('/saved/:id',
  requirePermission(Permission.BOOKS_VIEW),
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const savedSearch = await savedSearchService.getSavedSearchById(id, userId);

    if (!savedSearch) {
      res.status(404).json({
        success: false,
        error: 'Saved search not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Record that this search was used
    if (userId) {
      try {
        await savedSearchService.recordSavedSearchUse(id, userId);
      } catch (error) {
        logger.warn('Failed to record saved search use', { error: (error as Error).message });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: savedSearch,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting saved search', {
      error: (error as Error).message,
      params: req.params,
      userId: (req as any).user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Update a saved search
router.put('/saved/:id',
  auditMiddleware('UPDATE_SAVED_SEARCH'),
  requirePermission(Permission.BOOKS_VIEW),
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { name, description, entityType, searchParams, isPublic, enableNotifications } = req.body;

    const savedSearch = await savedSearchService.updateSavedSearch(id, userId, {
      name,
      description,
      entityType,
      searchParams,
      isPublic,
      enableNotifications,
    });

    const response: ApiResponse = {
      success: true,
      data: savedSearch,
      message: 'Saved search updated successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error updating saved search', {
      error: (error as Error).message,
      params: req.params,
      userId: (req as any).user?.id,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete a saved search
router.delete('/saved/:id',
  auditMiddleware('DELETE_SAVED_SEARCH'),
  requirePermission(Permission.BOOKS_VIEW),
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await savedSearchService.deleteSavedSearch(id, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Saved search deleted successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error deleting saved search', {
      error: (error as Error).message,
      params: req.params,
      userId: (req as any).user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get popular saved searches (public)
router.get('/saved/popular', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;

    const popularSearches = await savedSearchService.getPopularSavedSearches(
      parseInt(limit as string)
    );

    const response: ApiResponse = {
      success: true,
      data: popularSearches,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error getting popular saved searches', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;