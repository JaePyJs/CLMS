// Service exports for dependency injection
// This file centralizes all service exports for easy importing

// Class-based services (for DI container)
export { AuthService } from './authService';
export { AutomationService } from './automation';
export { EquipmentService } from './enhancedEquipmentService';
export { FERPAService } from './ferpaService';

// Function-based services (to be refactored to classes if needed for DI)
export * as BookService from './bookService';
export * as StudentService from './studentService';
export * as NotificationService from './notification.service';
export * as AnalyticsService from './analyticsService';

// Additional service exports
export * from './auditService';
export * from './barcodeService';
export * from './qrCodeService';
export * from './scanService';
export * from './reportingService';
export * from './googleSheets';
export * from './importService';
export * from './backup.service';

// Enhanced services
export { AdvancedCachingService } from './advancedCachingService';
export { default as EnhancedAuthService } from './enhancedAuthService';
export { default as EnhancedCacheService } from './enhancedCacheService';
export { default as EnhancedSearchService } from './enhancedSearchService';

// Monitoring and performance services
export { default as MonitoringService } from './monitoringService';
export { performanceOptimizationService } from './performanceOptimizationService';
export * from './performanceMonitoringService';

// Security services
export { default as SecurityMonitoringService } from './securityMonitoringService';
export { default as EncryptionService } from './encryptionService';

// Utility services
export * from './rateLimitService';
export { default as EmailService } from './emailService';
export { schedulerService } from './schedulerService';

// Equipment-related services
export * from './equipmentAnalyticsService';
export * from './equipmentSchedulingService';

// FERPA compliance
export * from './ferpaComplianceService';

// Error handling services
export * from './errorReportingService';
export * from './errorNotificationService';

// Search services
export { default as SavedSearchService } from './savedSearchService';
export { default as SearchAnalyticsService } from './searchAnalyticsService';

// Other services
export { default as DocumentationService } from './documentationService';
export * from './recoveryService';
