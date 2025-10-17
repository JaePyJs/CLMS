import { faker } from '@faker-js/faker';
import type { equipment, equipment_type, equipment_status, equipment_condition_rating, Prisma } from '@prisma/client';
import { BaseFactory } from './BaseFactory';

/**
 * Equipment Factory
 * 
 * Generates valid equipment data with realistic specifications,
 * maintenance schedules, and proper equipment information that matches the database schema.
 */
export class EquipmentFactory extends BaseFactory<
  equipment,
  Prisma.equipmentCreateInput,
  Prisma.equipmentUpdateInput
> {
  /**
   * Realistic equipment names by type
   */
  private static readonly EQUIPMENT_NAMES = {
    COMPUTER: [
      'Desktop Computer Unit', 'All-in-One PC', 'Gaming Desktop', 'Workstation Computer',
      'Mini PC', 'Tower Computer', 'Student Computer Station', 'Research Computer'
    ],
    GAMING: [
      'Gaming Console', 'VR Headset', 'Gaming Chair', 'Racing Wheel',
      'Gaming Mouse', 'Mechanical Keyboard', 'Game Controller', 'Gaming Monitor'
    ],
    AVR: [
      'Projector', 'LCD Projector', 'Overhead Projector', 'Projection Screen',
      'Sound System', 'Amplifier', 'Microphone', 'Speaker System', 'Audio Mixer'
    ],
    PRINTER: [
      'Laser Printer', 'Inkjet Printer', 'Multifunction Printer', 'Photo Printer',
      'Label Printer', '3D Printer', 'Large Format Printer', 'Network Printer'
    ],
    SCANNER: [
      'Document Scanner', 'Photo Scanner', 'Flatbed Scanner', 'Portable Scanner',
      'Book Scanner', 'Barcode Scanner', 'Business Card Scanner'
    ],
    OTHER: [
      'Laminator', 'Paper Shredder', 'Binding Machine', 'Photocopier',
      'Whiteboard', 'Smart Board', 'Digital Camera', 'Video Camera', 'Tripod'
    ]
  } as const;

  /**
   * Realistic locations for equipment
   */
  private static readonly EQUIPMENT_LOCATIONS = [
    'Computer Lab 1', 'Computer Lab 2', 'Library Main Area', 'Library Study Room',
    'AV Room', 'Multipurpose Hall', 'Science Lab', 'Faculty Room', 'Administrative Office',
    'Guidance Office', 'Audio-Visual Room', 'Technical Workshop', 'Media Center'
  ] as const;

  /**
   * Realistic manufacturers
   */
  private static readonly MANUFACTURERS = [
    'Dell', 'HP', 'Lenovo', 'Acer', 'Asus', 'Apple', 'Samsung', 'LG',
    'Canon', 'Epson', 'Brother', 'Xerox', 'Sony', 'Microsoft', 'Logitech'
  ] as const;

  /**
   * Equipment categories
   */
  private static readonly EQUIPMENT_CATEGORIES = [
    'Computing', 'Audio-Visual', 'Printing', 'Scanning', 'Gaming', 'Office Equipment',
    'Photography', 'Presentation', 'Network Equipment', 'Storage Devices'
  ] as const;

  /**
   * Create a single equipment with valid data
   */
  create(overrides: Partial<Prisma.equipmentCreateInput> = {}): equipment {
    const type = BaseFactory.randomEnum(Object.values(equipment_type));
    const equipmentId = BaseFactory.generateEquipmentId();
    const timestamps = BaseFactory.generateTimestamps({ ageInDays: faker.number.int({ min: 1, max: 1825 }) });

    const purchaseDate = BaseFactory.randomPastDate({ years: faker.number.int({ min: 1, max: 5 }) });
    const warrantyExpiry = BaseFactory.randomFutureDate({ years: faker.number.int({ min: 1, max: 3 }) });
    const lastMaintenance = BaseFactory.randomPastDate({ months: faker.number.int({ min: 1, max: 6 }) });
    const nextMaintenance = BaseFactory.randomFutureDate({ months: faker.number.int({ min: 1, max: 6 }) });

    const baseData: Prisma.equipmentCreateInput = {
      id: BaseFactory.getNextId('equipment'),
      name: this.generateEquipmentName(type),
      type: type,
      location: BaseFactory.randomEnum(EquipmentFactory.EQUIPMENT_LOCATIONS),
      status: BaseFactory.randomEnum(Object.values(equipment_status)),
      description: this.generateDescription(type),
      created_at: timestamps.created_at,
      updated_at: timestamps.updated_at,
      equipment_id: equipmentId,
      max_time_minutes: this.generateMaxTime(type),
      requires_supervision: this.requiresSupervision(type),
      purchase_date: purchaseDate,
      purchase_cost: BaseFactory.randomFloat(5000, 100000, 2),
      serial_number: `SN${BaseFactory.randomAlphanumeric(10).toUpperCase()}`,
      asset_tag: `AT${BaseFactory.randomAlphanumeric(8).toUpperCase()}`,
      warranty_expiry: warrantyExpiry,
      condition_rating: BaseFactory.randomEnum(Object.values(equipment_condition_rating)),
      maintenance_interval: this.generateMaintenanceInterval(type),
      last_maintenance: lastMaintenance,
      next_maintenance: nextMaintenance,
      total_usage_hours: BaseFactory.randomFloat(0, 2000, 1),
      daily_usage_hours: BaseFactory.randomFloat(0, 8, 1),
      qr_code_data: `QR_${equipmentId}`,
      barcode_data: `BC_${equipmentId}`,
      category: BaseFactory.randomEnum(EquipmentFactory.EQUIPMENT_CATEGORIES),
      tags: this.generateTags(type),
      specifications: this.generateSpecifications(type),
      notes: BaseFactory.randomBoolean(0.4) ? faker.lorem.sentence() : null,
      is_active: BaseFactory.randomBoolean(0.9), // 90% active
    };

    const finalData = BaseFactory.applyOverrides(baseData, overrides);

    // Validate required fields
    BaseFactory.validateData(finalData, [
      'id', 'name', 'type', 'location', 'equipment_id'
    ]);

    return finalData as equipment;
  }

  /**
   * Create equipment with specific type
   */
  createWithType(type: equipment_type, count: number = 1): equipment[] {
    return this.createMany(count, { type });
  }

  /**
   * Create available equipment
   */
  createAvailable(count: number = 1): equipment[] {
    return this.createMany(count, {
      status: equipment_status.AVAILABLE,
      is_active: true
    });
  }

  /**
   * Create equipment in use
   */
  createInUse(count: number = 1): equipment[] {
    return this.createMany(count, {
      status: equipment_status.IN_USE,
      is_active: true
    });
  }

  /**
   * Create equipment under maintenance
   */
  createUnderMaintenance(count: number = 1): equipment[] {
    return this.createMany(count, {
      status: equipment_status.MAINTENANCE,
      is_active: true
    });
  }

  /**
   * Create out of order equipment
   */
  createOutOfOrder(count: number = 1): equipment[] {
    return this.createMany(count, {
      status: equipment_status.OUT_OF_ORDER,
      condition_rating: BaseFactory.randomEnum([
        equipment_condition_rating.POOR,
        equipment_condition_rating.DAMAGED
      ]),
      is_active: false
    });
  }

  /**
   * Create reserved equipment
   */
  createReserved(count: number = 1): equipment[] {
    return this.createMany(count, {
      status: equipment_status.RESERVED,
      is_active: true
    });
  }

  /**
   * Create retired equipment
   */
  createRetired(count: number = 1): equipment[] {
    return this.createMany(count, {
      status: equipment_status.RETIRED,
      is_active: false,
      condition_rating: equipment_condition_rating.POOR
    });
  }

  /**
   * Create computers specifically
   */
  createComputers(count: number = 1): equipment[] {
    return this.createWithType(equipment_type.COMPUTER, count);
  }

  /**
   * Create gaming equipment
   */
  createGamingEquipment(count: number = 1): equipment[] {
    return this.createWithType(equipment_type.GAMING, count);
  }

  /**
   * Create AV equipment
   */
  createAVEquipment(count: number = 1): equipment[] {
    return this.createWithType(equipment_type.AVR, count);
  }

  /**
   * Create high-value equipment (expensive items)
   */
  createHighValueEquipment(count: number = 1): equipment[] {
    return this.createMany(count, {
      purchase_cost: BaseFactory.randomFloat(50000, 200000, 2),
      requires_supervision: true,
      condition_rating: BaseFactory.randomEnum([
        equipment_condition_rating.EXCELLENT,
        equipment_condition_rating.GOOD
      ])
    });
  }

  /**
   * Create equipment requiring supervision
   */
  createSupervisedEquipment(count: number = 1): equipment[] {
    return this.createMany(count, {
      requires_supervision: true,
      max_time_minutes: BaseFactory.randomInt(30, 120)
    });
  }

  /**
   * Create equipment with specific conditions
   */
  createWithCondition(condition: equipment_condition_rating, count: number = 1): equipment[] {
    return this.createMany(count, {
      condition_rating: condition
    });
  }

  /**
   * Create equipment at specific location
   */
  createAtLocation(location: string, count: number = 1): equipment[] {
    return this.createMany(count, { location });
  }

  /**
   * Create a diverse equipment inventory
   */
  createDiverseInventory(count: number = 50): equipment[] {
    const distribution = {
      [equipment_type.COMPUTER]: Math.floor(count * 0.4),    // 40% computers
      [equipment_type.AVR]: Math.floor(count * 0.2),        // 20% AV equipment
      [equipment_type.PRINTER]: Math.floor(count * 0.15),    // 15% printers
      [equipment_type.SCANNER]: Math.floor(count * 0.1),     // 10% scanners
      [equipment_type.GAMING]: Math.floor(count * 0.1),      // 10% gaming
      [equipment_type.OTHER]: Math.floor(count * 0.05)       // 5% other
    };

    const equipment: equipment[] = [];

    Object.entries(distribution).forEach(([type, typeCount]) => {
      equipment.push(...this.createWithType(type as equipment_type, typeCount));
    });

    return equipment;
  }

  /**
   * Create equipment with maintenance scenarios
   */
  createWithMaintenanceScenarios(): {
    newEquipment: equipment[];
    wellMaintained: equipment[];
    dueForMaintenance: equipment[];
    overdueMaintenance: equipment[];
    problematicEquipment: equipment[];
  } {
    const now = new Date();

    // New equipment (recently purchased)
    const newEquipment = this.createMany(8, {
      purchase_date: BaseFactory.randomRecentDate({ days: 30 }),
      created_at: BaseFactory.randomRecentDate({ days: 30 }),
      condition_rating: equipment_condition_rating.EXCELLENT,
      last_maintenance: BaseFactory.randomRecentDate({ days: 7 }),
      next_maintenance: BaseFactory.randomFutureDate({ months: 6 }),
      total_usage_hours: BaseFactory.randomFloat(0, 50, 1)
    });

    // Well maintained equipment
    const wellMaintained = this.createMany(15, {
      condition_rating: BaseFactory.randomEnum([
        equipment_condition_rating.EXCELLENT,
        equipment_condition_rating.GOOD
      ]),
      last_maintenance: BaseFactory.randomPastDate({ months: 1 }),
      next_maintenance: BaseFactory.randomFutureDate({ months: 3 }),
      total_usage_hours: BaseFactory.randomFloat(100, 1000, 1)
    });

    // Due for maintenance
    const dueForMaintenance = this.createMany(6, {
      status: equipment_status.MAINTENANCE,
      next_maintenance: BaseFactory.randomPastDate({ days: 7 }),
      last_maintenance: BaseFactory.randomPastDate({ months: 6 })
    });

    // Overdue maintenance
    const overdueMaintenance = this.createMany(4, {
      status: equipment_status.OUT_OF_ORDER,
      condition_rating: BaseFactory.randomEnum([
        equipment_condition_rating.FAIR,
        equipment_condition_rating.POOR
      ]),
      next_maintenance: BaseFactory.randomPastDate({ months: 2 }),
      last_maintenance: BaseFactory.randomPastDate({ months: 8 })
    });

    // Problematic equipment (frequent issues)
    const problematicEquipment = this.createMany(3, {
      condition_rating: equipment_condition_rating.POOR,
      status: equipment_status.OUT_OF_ORDER,
      total_usage_hours: BaseFactory.randomFloat(1500, 3000, 1),
      last_maintenance: BaseFactory.randomPastDate({ months: 4 }),
      next_maintenance: BaseFactory.randomPastDate({ months: 1 })
    });

    return {
      newEquipment,
      wellMaintained,
      dueForMaintenance,
      overdueMaintenance,
      problematicEquipment
    };
  }

  /**
   * Create equipment with usage patterns
   */
  createWithUsagePatterns(): {
    highUsage: equipment[];
    mediumUsage: equipment[];
    lowUsage: equipment[];
    neverUsed: equipment[];
  } {
    return {
      // High usage equipment (computers, printers)
      highUsage: this.createMany(10, {
        type: BaseFactory.randomEnum([equipment_type.COMPUTER, equipment_type.PRINTER]),
        total_usage_hours: BaseFactory.randomFloat(1000, 3000, 1),
        daily_usage_hours: BaseFactory.randomFloat(4, 8, 1),
        condition_rating: BaseFactory.randomEnum([
          equipment_condition_rating.GOOD,
          equipment_condition_rating.FAIR
        ])
      }),

      // Medium usage equipment (AV, scanners)
      mediumUsage: this.createMany(15, {
        type: BaseFactory.randomEnum([equipment_type.AVR, equipment_type.SCANNER]),
        total_usage_hours: BaseFactory.randomFloat(200, 1000, 1),
        daily_usage_hours: BaseFactory.randomFloat(1, 4, 1),
        condition_rating: BaseFactory.randomEnum([
          equipment_condition_rating.GOOD,
          equipment_condition_rating.EXCELLENT
        ])
      }),

      // Low usage equipment (specialized equipment)
      lowUsage: this.createMany(8, {
        type: BaseFactory.randomEnum([equipment_type.GAMING, equipment_type.OTHER]),
        total_usage_hours: BaseFactory.randomFloat(10, 200, 1),
        daily_usage_hours: BaseFactory.randomFloat(0, 1, 1),
        condition_rating: equipment_condition_rating.EXCELLENT
      }),

      // Never used equipment (brand new)
      neverUsed: this.createMany(5, {
        total_usage_hours: 0,
        daily_usage_hours: 0,
        condition_rating: equipment_condition_rating.EXCELLENT,
        created_at: BaseFactory.randomRecentDate({ days: 14 }),
        last_maintenance: null
      })
    };
  }

  /**
   * Generate equipment name based on type
   */
  private generateEquipmentName(type: equipment_type): string {
    const names = EquipmentFactory.EQUIPMENT_NAMES[type];
    return BaseFactory.randomEnum(names);
  }

  /**
   * Generate description based on equipment type
   */
  private generateDescription(type: equipment_type): string | null {
    const descriptions = {
      [equipment_type.COMPUTER]: [
        'High-performance computer for student use',
        'Desktop computer with internet access',
        'Computer workstation for research and assignments',
        'All-in-one computer with built-in monitor'
      ],
      [equipment_type.GAMING]: [
        'Gaming console for recreational activities',
        'VR headset for immersive experiences',
        'Gaming setup with accessories',
        'Entertainment system for student breaks'
      ],
      [equipment_type.AVR]: [
        'High-quality projector for presentations',
        'Audio system for events and meetings',
        'Complete AV setup for multimedia presentations',
        'Professional sound system with microphone'
      ],
      [equipment_type.PRINTER]: [
        'High-speed laser printer for documents',
        'Color printer for projects and reports',
        'Multifunction printer with scanning capabilities',
        'Network printer for multiple users'
      ],
      [equipment_type.SCANNER]: [
        'Document scanner for digitization',
        'Photo scanner for high-quality images',
        'Book scanner for library materials',
        'Portable scanner for convenience'
      ],
      [equipment_type.OTHER]: [
        'Multi-purpose office equipment',
        'Specialized equipment for specific tasks',
        'Support equipment for various activities',
        'Additional equipment for enhanced functionality'
      ]
    };

    const typeDescriptions = descriptions[type];
    return BaseFactory.randomEnum(typeDescriptions);
  }

  /**
   * Generate maximum time allowed based on equipment type
   */
  private generateMaxTime(type: equipment_type): number {
    const timeLimits = {
      [equipment_type.COMPUTER]: BaseFactory.randomInt(60, 180),
      [equipment_type.GAMING]: BaseFactory.randomInt(30, 90),
      [equipment_type.AVR]: BaseFactory.randomInt(120, 240),
      [equipment_type.PRINTER]: BaseFactory.randomInt(15, 60),
      [equipment_type.SCANNER]: BaseFactory.randomInt(30, 90),
      [equipment_type.OTHER]: BaseFactory.randomInt(60, 120)
    };

    return timeLimits[type];
  }

  /**
   * Determine if equipment requires supervision
   */
  private requiresSupervision(type: equipment_type): boolean {
    const supervisionRequired = {
      [equipment_type.COMPUTER]: false,
      [equipment_type.GAMING]: true,
      [equipment_type.AVR]: true,
      [equipment_type.PRINTER]: false,
      [equipment_type.SCANNER]: false,
      [equipment_type.OTHER]: BaseFactory.randomBoolean(0.3)
    };

    return supervisionRequired[type];
  }

  /**
   * Generate maintenance interval based on equipment type
   */
  private generateMaintenanceInterval(type: equipment_type): number | null {
    const intervals = {
      [equipment_type.COMPUTER]: 90,    // 3 months
      [equipment_type.GAMING]: 60,      // 2 months
      [equipment_type.AVR]: 30,         // 1 month
      [equipment_type.PRINTER]: 60,     // 2 months
      [equipment_type.SCANNER]: 90,     // 3 months
      [equipment_type.OTHER]: 120       // 4 months
    };

    return intervals[type];
  }

  /**
   * Generate tags based on equipment type
   */
  private generateTags(type: equipment_type): any {
    const tagSets = {
      [equipment_type.COMPUTER]: ['computer', 'desktop', 'workstation', 'research'],
      [equipment_type.GAMING]: ['gaming', 'entertainment', 'recreation', 'vr'],
      [equipment_type.AVR]: ['audio', 'visual', 'presentation', 'multimedia'],
      [equipment_type.PRINTER]: ['printing', 'document', 'output', 'paper'],
      [equipment_type.SCANNER]: ['scanning', 'digitization', 'input', 'imaging'],
      [equipment_type.OTHER]: ['office', 'utility', 'support', 'miscellaneous']
    };

    return tagSets[type];
  }

  /**
   * Generate specifications based on equipment type
   */
  private generateSpecifications(type: equipment_type): any {
    const specs = {
      [equipment_type.COMPUTER]: {
        cpu: BaseFactory.randomEnum(['Intel i5', 'Intel i7', 'AMD Ryzen 5', 'AMD Ryzen 7']),
        ram: `${BaseFactory.randomInt(8, 32)}GB`,
        storage: `${BaseFactory.randomInt(256, 1024)}GB SSD`,
        operating_system: BaseFactory.randomEnum(['Windows 11', 'Ubuntu', 'macOS'])
      },
      [equipment_type.GAMING]: {
        platform: BaseFactory.randomEnum(['PlayStation 5', 'Xbox Series X', 'Nintendo Switch']),
        resolution: '4K',
        refresh_rate: '60Hz',
        storage: `${BaseFactory.randomInt(512, 1024)}GB`
      },
      [equipment_type.AVR]: {
        resolution: BaseFactory.randomEnum(['1080p', '4K']),
        brightness: `${BaseFactory.randomInt(3000, 5000)} lumens`,
        sound_system: BaseFactory.randomEnum(['2.1 Channel', '5.1 Surround', '7.1 Surround']),
        connectivity: BaseFactory.randomEnum(['HDMI', 'Wireless', 'Bluetooth'])
      },
      [equipment_type.PRINTER]: {
        type: BaseFactory.randomEnum(['Laser', 'Inkjet', 'Multifunction']),
        speed: `${BaseFactory.randomInt(20, 60)} ppm`,
        resolution: `${BaseFactory.randomInt(600, 2400)} dpi`,
        connectivity: BaseFactory.randomEnum(['USB', 'Network', 'Wireless'])
      },
      [equipment_type.SCANNER]: {
        type: BaseFactory.randomEnum(['Flatbed', 'Sheet-fed', 'Portable']),
        resolution: `${BaseFactory.randomInt(600, 4800)} dpi`,
        speed: `${BaseFactory.randomInt(10, 30)} ppm`,
        format: BaseFactory.randomEnum(['A4', 'Legal', 'Letter'])
      },
      [equipment_type.OTHER]: {
        category: 'miscellaneous',
        power_requirement: '220V',
        dimensions: `${BaseFactory.randomInt(30, 100)}x${BaseFactory.randomInt(30, 100)}x${BaseFactory.randomInt(30, 100)}cm`,
        weight: `${BaseFactory.randomInt(5, 50)}kg`
      }
    };

    return specs[type];
  }
}