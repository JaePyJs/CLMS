import { logger } from '@/utils/logger';
import { Redis } from 'ioredis';
import { ScannerConfig, ScannerDevice } from './usbScannerService';

// Scanner station configuration
export interface ScannerStation {
  id: string;
  name: string;
  location: string;
  description?: string;
  scannerConfigs: ScannerConfig[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Scanner profile templates
export interface ScannerProfile {
  id: string;
  name: string;
  description: string;
  config: Partial<ScannerConfig>;
  supportedDevices: Array<{
    vendorId?: number;
    productId?: number;
    name?: string;
  }>;
}

// Default scanner profiles
const DEFAULT_PROFILES: ScannerProfile[] = [
  {
    id: 'student-id',
    name: 'Student ID Scanner',
    description: 'Optimized for scanning student ID cards and barcodes',
    config: {
      name: 'Student ID Scanner',
      enabled: true,
      bufferSize: 64,
      timeout: 100,
      minLength: 3,
      maxLength: 20,
      beepOnScan: true,
      visualFeedback: true,
      duplicatePrevention: true,
      duplicateWindow: 30 * 60 * 1000, // 30 minutes
    },
    supportedDevices: [
      { name: 'Honeywell 1200g' },
      { name: 'Zebra LS2208' },
      { name: 'Datalogic QuickScan' },
    ],
  },
  {
    id: 'book-barcode',
    name: 'Book Barcode Scanner',
    description: 'Optimized for scanning book accession numbers and ISBNs',
    config: {
      name: 'Book Barcode Scanner',
      enabled: true,
      bufferSize: 128,
      timeout: 150,
      minLength: 8,
      maxLength: 20,
      beepOnScan: true,
      visualFeedback: false,
      duplicatePrevention: false,
      duplicateWindow: 0,
    },
    supportedDevices: [
      { name: 'Honeywell 1900g' },
      { name: 'Zebra LI2208' },
      { name: 'Datalogic Gryphon' },
    ],
  },
  {
    id: 'equipment-tag',
    name: 'Equipment Tag Scanner',
    description: 'Optimized for scanning equipment asset tags',
    config: {
      name: 'Equipment Tag Scanner',
      enabled: true,
      bufferSize: 64,
      timeout: 120,
      minLength: 5,
      maxLength: 25,
      beepOnScan: true,
      visualFeedback: true,
      duplicatePrevention: false,
      duplicateWindow: 0,
      prefix: 'EQ-',
    },
    supportedDevices: [
      { name: 'Symbol LS2208' },
      { name: 'Zebra DS2208' },
      { name: 'Generic Barcode Scanner' },
    ],
  },
  {
    id: 'multi-purpose',
    name: 'Multi-Purpose Scanner',
    description: 'General purpose scanner for all types of barcodes',
    config: {
      name: 'Multi-Purpose Scanner',
      enabled: true,
      bufferSize: 128,
      timeout: 100,
      minLength: 3,
      maxLength: 50,
      beepOnScan: true,
      visualFeedback: true,
      duplicatePrevention: true,
      duplicateWindow: 60 * 1000, // 1 minute
    },
    supportedDevices: [
      { name: 'Any USB Barcode Scanner' },
    ],
  },
];

export class ScannerConfigService {
  private redis: Redis;
  private stations: Map<string, ScannerStation> = new Map();
  private profiles: Map<string, ScannerProfile> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    this.initializeService();
  }

  // Initialize the configuration service
  private async initializeService() {
    try {
      logger.info('Initializing Scanner Configuration Service');

      // Load default profiles
      await this.loadDefaultProfiles();

      // Load existing stations from Redis
      await this.loadStationsFromRedis();

      logger.info('Scanner Configuration Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Scanner Configuration Service', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Load default scanner profiles
  private async loadDefaultProfiles() {
    try {
      for (const profile of DEFAULT_PROFILES) {
        this.profiles.set(profile.id, profile);
      }
      logger.info(`Loaded ${DEFAULT_PROFILES.length} default scanner profiles`);
    } catch (error) {
      logger.error('Failed to load default profiles', { error: (error as Error).message });
    }
  }

  // Load stations from Redis
  private async loadStationsFromRedis() {
    try {
      const stationKeys = await this.redis.keys('scanner:station:*');

      for (const key of stationKeys) {
        const stationData = await this.redis.get(key);
        if (stationData) {
          const station: ScannerStation = JSON.parse(stationData);
          this.stations.set(station.id, station);
        }
      }

      logger.info(`Loaded ${this.stations.size} scanner stations from Redis`);
    } catch (error) {
      logger.error('Failed to load stations from Redis', { error: (error as Error).message });
    }
  }

  // Create a new scanner station
  async createStation(stationData: Omit<ScannerStation, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScannerStation> {
    try {
      const station: ScannerStation = {
        ...stationData,
        id: this.generateStationId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to Redis
      await this.saveStationToRedis(station);
      this.stations.set(station.id, station);

      logger.info('Scanner station created', { stationId: station.id, name: station.name });
      return station;
    } catch (error) {
      logger.error('Failed to create scanner station', { error: (error as Error).message });
      throw error;
    }
  }

  // Update a scanner station
  async updateStation(stationId: string, updates: Partial<ScannerStation>): Promise<ScannerStation | null> {
    try {
      const existingStation = this.stations.get(stationId);
      if (!existingStation) {
        return null;
      }

      const updatedStation: ScannerStation = {
        ...existingStation,
        ...updates,
        id: stationId, // Ensure ID doesn't change
        updatedAt: new Date(),
      };

      // Save to Redis
      await this.saveStationToRedis(updatedStation);
      this.stations.set(stationId, updatedStation);

      logger.info('Scanner station updated', { stationId, updates });
      return updatedStation;
    } catch (error) {
      logger.error('Failed to update scanner station', {
        error: (error as Error).message,
        stationId,
      });
      throw error;
    }
  }

  // Delete a scanner station
  async deleteStation(stationId: string): Promise<boolean> {
    try {
      const station = this.stations.get(stationId);
      if (!station) {
        return false;
      }

      // Remove from Redis
      await this.redis.del(`scanner:station:${stationId}`);
      this.stations.delete(stationId);

      logger.info('Scanner station deleted', { stationId });
      return true;
    } catch (error) {
      logger.error('Failed to delete scanner station', {
        error: (error as Error).message,
        stationId,
      });
      return false;
    }
  }

  // Get all scanner stations
  getStations(): ScannerStation[] {
    return Array.from(this.stations.values());
  }

  // Get a specific scanner station
  getStation(stationId: string): ScannerStation | null {
    return this.stations.get(stationId) || null;
  }

  // Get active scanner stations
  getActiveStations(): ScannerStation[] {
    return Array.from(this.stations.values()).filter(station => station.isActive);
  }

  // Add scanner configuration to a station
  async addScannerConfig(stationId: string, config: ScannerConfig): Promise<boolean> {
    try {
      const station = this.stations.get(stationId);
      if (!station) {
        return false;
      }

      // Add config to station
      station.scannerConfigs.push(config);
      station.updatedAt = new Date();

      // Save to Redis
      await this.saveStationToRedis(station);
      this.stations.set(stationId, station);

      logger.info('Scanner configuration added to station', {
        stationId,
        configName: config.name,
      });
      return true;
    } catch (error) {
      logger.error('Failed to add scanner configuration to station', {
        error: (error as Error).message,
        stationId,
      });
      return false;
    }
  }

  // Remove scanner configuration from a station
  async removeScannerConfig(stationId: string, configName: string): Promise<boolean> {
    try {
      const station = this.stations.get(stationId);
      if (!station) {
        return false;
      }

      // Remove config from station
      station.scannerConfigs = station.scannerConfigs.filter(config => config.name !== configName);
      station.updatedAt = new Date();

      // Save to Redis
      await this.saveStationToRedis(station);
      this.stations.set(stationId, station);

      logger.info('Scanner configuration removed from station', {
        stationId,
        configName,
      });
      return true;
    } catch (error) {
      logger.error('Failed to remove scanner configuration from station', {
        error: (error as Error).message,
        stationId,
        configName,
      });
      return false;
    }
  }

  // Get all scanner profiles
  getProfiles(): ScannerProfile[] {
    return Array.from(this.profiles.values());
  }

  // Get a specific scanner profile
  getProfile(profileId: string): ScannerProfile | null {
    return this.profiles.get(profileId) || null;
  }

  // Create custom scanner profile
  async createProfile(profileData: Omit<ScannerProfile, 'id'>): Promise<ScannerProfile> {
    try {
      const profile: ScannerProfile = {
        ...profileData,
        id: this.generateProfileId(),
      };

      // Save to Redis
      await this.saveProfileToRedis(profile);
      this.profiles.set(profile.id, profile);

      logger.info('Scanner profile created', { profileId: profile.id, name: profile.name });
      return profile;
    } catch (error) {
      logger.error('Failed to create scanner profile', { error: (error as Error).message });
      throw error;
    }
  }

  // Update scanner profile
  async updateProfile(profileId: string, updates: Partial<ScannerProfile>): Promise<ScannerProfile | null> {
    try {
      const existingProfile = this.profiles.get(profileId);
      if (!existingProfile) {
        return null;
      }

      const updatedProfile: ScannerProfile = {
        ...existingProfile,
        ...updates,
        id: profileId, // Ensure ID doesn't change
      };

      // Save to Redis
      await this.saveProfileToRedis(updatedProfile);
      this.profiles.set(profileId, updatedProfile);

      logger.info('Scanner profile updated', { profileId, updates });
      return updatedProfile;
    } catch (error) {
      logger.error('Failed to update scanner profile', {
        error: (error as Error).message,
        profileId,
      });
      throw error;
    }
  }

  // Delete scanner profile
  async deleteProfile(profileId: string): Promise<boolean> {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        return false;
      }

      // Don't allow deletion of default profiles
      if (DEFAULT_PROFILES.some(p => p.id === profileId)) {
        logger.warn('Attempted to delete default profile', { profileId });
        return false;
      }

      // Remove from Redis
      await this.redis.del(`scanner:profile:${profileId}`);
      this.profiles.delete(profileId);

      logger.info('Scanner profile deleted', { profileId });
      return true;
    } catch (error) {
      logger.error('Failed to delete scanner profile', {
        error: (error as Error).message,
        profileId,
      });
      return false;
    }
  }

  // Apply profile to scanner configuration
  applyProfile(profileId: string, baseConfig: Partial<ScannerConfig>): ScannerConfig {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        throw new Error(`Profile not found: ${profileId}`);
      }

      // Merge profile config with base config
      const mergedConfig: ScannerConfig = {
        name: baseConfig.name || profile.config.name || 'Scanner',
        enabled: baseConfig.enabled !== undefined ? baseConfig.enabled : profile.config.enabled || true,
        bufferSize: baseConfig.bufferSize || profile.config.bufferSize || 64,
        timeout: baseConfig.timeout || profile.config.timeout || 100,
        minLength: baseConfig.minLength || profile.config.minLength || 3,
        maxLength: baseConfig.maxLength || profile.config.maxLength || 50,
        beepOnScan: baseConfig.beepOnScan !== undefined ? baseConfig.beepOnScan : profile.config.beepOnScan || true,
        visualFeedback: baseConfig.visualFeedback !== undefined ? baseConfig.visualFeedback : profile.config.visualFeedback || true,
        duplicatePrevention: baseConfig.duplicatePrevention !== undefined ? baseConfig.duplicatePrevention : profile.config.duplicatePrevention || false,
        duplicateWindow: baseConfig.duplicateWindow || profile.config.duplicateWindow || 30000,
        prefix: baseConfig.prefix || profile.config.prefix,
        suffix: baseConfig.suffix || profile.config.suffix,
        vendorId: baseConfig.vendorId,
        productId: baseConfig.productId,
        devicePath: baseConfig.devicePath,
      };

      return mergedConfig;
    } catch (error) {
      logger.error('Failed to apply profile to scanner configuration', {
        error: (error as Error).message,
        profileId,
      });
      throw error;
    }
  }

  // Validate scanner configuration
  validateConfig(config: ScannerConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!config.name || config.name.trim() === '') {
      errors.push('Scanner name is required');
    }

    if (config.bufferSize <= 0) {
      errors.push('Buffer size must be greater than 0');
    }

    if (config.timeout <= 0) {
      errors.push('Timeout must be greater than 0');
    }

    if (config.minLength <= 0) {
      errors.push('Minimum length must be greater than 0');
    }

    if (config.maxLength <= 0) {
      errors.push('Maximum length must be greater than 0');
    }

    if (config.minLength > config.maxLength) {
      errors.push('Minimum length cannot be greater than maximum length');
    }

    if (config.duplicateWindow < 0) {
      errors.push('Duplicate window cannot be negative');
    }

    // Check device identification
    if (!config.devicePath && (!config.vendorId || !config.productId)) {
      errors.push('Either device path or vendor ID and product ID must be specified');
    }

    if (config.vendorId && (config.vendorId < 0 || config.vendorId > 0xFFFF)) {
      errors.push('Vendor ID must be between 0 and 65535');
    }

    if (config.productId && (config.productId < 0 || config.productId > 0xFFFF)) {
      errors.push('Product ID must be between 0 and 65535');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Auto-configure scanner based on detected device
  async autoConfigureScanner(device: ScannerDevice): Promise<ScannerConfig[]> {
    try {
      const configs: ScannerConfig[] = [];

      // Try to match device against known profiles
      for (const profile of this.profiles.values()) {
        for (const supportedDevice of profile.supportedDevices) {
          if (this.deviceMatchesProfile(device, supportedDevice)) {
            const config: ScannerConfig = {
              ...profile.config,
              name: `${profile.config.name} - ${device.product}`,
              vendorId: device.vendorId,
              productId: device.productId,
              devicePath: device.path,
            };

            const validation = this.validateConfig(config);
            if (validation.valid) {
              configs.push(config);
            } else {
              logger.warn('Auto-generated config failed validation', {
                device: device.product,
                profile: profile.name,
                errors: validation.errors,
              });
            }
          }
        }
      }

      // If no profile matches, create a generic config
      if (configs.length === 0) {
        const genericConfig: ScannerConfig = {
          name: `Generic Scanner - ${device.product}`,
          enabled: true,
          bufferSize: 64,
          timeout: 100,
          minLength: 3,
          maxLength: 50,
          beepOnScan: true,
          visualFeedback: true,
          duplicatePrevention: true,
          duplicateWindow: 30000,
          vendorId: device.vendorId,
          productId: device.productId,
          devicePath: device.path,
        };

        const validation = this.validateConfig(genericConfig);
        if (validation.valid) {
          configs.push(genericConfig);
        }
      }

      logger.info('Auto-configured scanner', {
        device: device.product,
        configsGenerated: configs.length,
      });

      return configs;
    } catch (error) {
      logger.error('Failed to auto-configure scanner', {
        error: (error as Error).message,
        device: device.product,
      });
      return [];
    }
  }

  // Check if device matches profile requirements
  private deviceMatchesProfile(device: ScannerDevice, supportedDevice: { vendorId?: number; productId?: number; name?: string }): boolean {
    if (supportedDevice.vendorId && device.vendorId !== supportedDevice.vendorId) {
      return false;
    }

    if (supportedDevice.productId && device.productId !== supportedDevice.productId) {
      return false;
    }

    if (supportedDevice.name) {
      const deviceName = (device.product || '').toLowerCase();
      const supportedName = supportedDevice.name.toLowerCase();
      if (!deviceName.includes(supportedName) && !supportedName.includes(deviceName)) {
        return false;
      }
    }

    return true;
  }

  // Save station to Redis
  private async saveStationToRedis(station: ScannerStation) {
    try {
      await this.redis.setex(
        `scanner:station:${station.id}`,
        60 * 60 * 24, // 24 hours TTL
        JSON.stringify(station)
      );
    } catch (error) {
      logger.error('Failed to save station to Redis', { error: (error as Error).message });
      throw error;
    }
  }

  // Save profile to Redis
  private async saveProfileToRedis(profile: ScannerProfile) {
    try {
      await this.redis.setex(
        `scanner:profile:${profile.id}`,
        60 * 60 * 24, // 24 hours TTL
        JSON.stringify(profile)
      );
    } catch (error) {
      logger.error('Failed to save profile to Redis', { error: (error as Error).message });
      throw error;
    }
  }

  // Generate unique station ID
  private generateStationId(): string {
    return `station_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique profile ID
  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Export configuration for backup
  async exportConfiguration(): Promise<{ stations: ScannerStation[]; profiles: ScannerProfile[] }> {
    return {
      stations: this.getStations(),
      profiles: this.getProfiles(),
    };
  }

  // Import configuration from backup
  async importConfiguration(data: { stations?: ScannerStation[]; profiles?: ScannerProfile[] }): Promise<void> {
    try {
      if (data.stations) {
        for (const station of data.stations) {
          await this.saveStationToRedis(station);
          this.stations.set(station.id, station);
        }
      }

      if (data.profiles) {
        for (const profile of data.profiles) {
          await this.saveProfileToRedis(profile);
          this.profiles.set(profile.id, profile);
        }
      }

      logger.info('Configuration imported successfully', {
        stations: data.stations?.length || 0,
        profiles: data.profiles?.length || 0,
      });
    } catch (error) {
      logger.error('Failed to import configuration', { error: (error as Error).message });
      throw error;
    }
  }
}

// Singleton instance
let configServiceInstance: ScannerConfigService | null = null;

export function getScannerConfigService(redis: Redis): ScannerConfigService {
  if (!configServiceInstance) {
    configServiceInstance = new ScannerConfigService(redis);
  }
  return configServiceInstance;
}

export default ScannerConfigService;