#!/usr/bin/env ts-node
/**
 * Personnel Seed Script
 * Seeds the database with 38 school personnel records
 * Run with: npx ts-node src/scripts/seed_personnel.ts
 */

import { PrismaClient, UserType } from '@prisma/client';

const prisma = new PrismaClient();

interface PersonnelRecord {
  id: string;
  lastName: string;
  firstName: string;
  academicYear: string;
  type: string;
  gender: string;
}

const personnelData: PersonnelRecord[] = [
  {
    id: 'PN00001',
    lastName: 'DE GUZMAN',
    firstName: 'JOANET',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00002',
    lastName: 'DESEO',
    firstName: 'AILEN',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00003',
    lastName: 'ARANTE',
    firstName: 'MATILDE A.',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00004',
    lastName: 'CAÑADA',
    firstName: 'MICHELLE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00005',
    lastName: 'LEONCITO',
    firstName: 'JENEVY B.',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00006',
    lastName: 'JUMARANG',
    firstName: 'JENNIFER',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00007',
    lastName: 'CRIZALDO',
    firstName: 'HAZEL JOY',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00008',
    lastName: 'INCIO',
    firstName: 'CATHERINE JUN',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00009',
    lastName: 'ARENAS',
    firstName: 'FRANCHEZCA',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00010',
    lastName: 'VILANDA',
    firstName: 'JAYVEE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Male',
  },
  {
    id: 'PN00011',
    lastName: 'MELENDRES',
    firstName: 'BYRON',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Male',
  },
  {
    id: 'PN00012',
    lastName: 'ANTONIO',
    firstName: 'MYRA C.',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00013',
    lastName: 'DE LEON',
    firstName: 'MAXX ANDREI',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Male',
  },
  {
    id: 'PN00014',
    lastName: 'BERDIDA',
    firstName: 'DANIEL',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Male',
  },
  {
    id: 'PN00015',
    lastName: 'GONZALES',
    firstName: 'EVA MARIE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00016',
    lastName: 'SANTOS',
    firstName: 'VIRGIN MARY',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00017',
    lastName: 'VILLENA',
    firstName: 'KRISTINE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00018',
    lastName: 'AGANA',
    firstName: 'CLAUDIA',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00019',
    lastName: 'DE LEON',
    firstName: 'REENA',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00020',
    lastName: 'ORQUETA',
    firstName: 'MARIVIC',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00021',
    lastName: 'CAJIGAS',
    firstName: 'PORTIA',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00022',
    lastName: 'ORTENERO',
    firstName: 'MELANIE R.',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00023',
    lastName: 'OCDENARIA',
    firstName: 'REX',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00024',
    lastName: 'CONCEPCION',
    firstName: 'ERICK',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Male',
  },
  {
    id: 'PN00025',
    lastName: 'FULGAR',
    firstName: 'GAIL',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00026',
    lastName: 'DEMAPE',
    firstName: 'JOHNIEL',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Male',
  },
  {
    id: 'PN00027',
    lastName: 'CALITISIN',
    firstName: 'YLAINE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00028',
    lastName: 'NANZAN',
    firstName: 'SHERIAN',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00029',
    lastName: 'ROSARIO',
    firstName: 'JENNIFER',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00030',
    lastName: 'TORRE',
    firstName: 'MIANNA',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00031',
    lastName: 'PAGDAYUNAN',
    firstName: 'XYRILL PIOLO',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00032',
    lastName: 'FRONDA',
    firstName: 'JOHN CARLO',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Male',
  },
  {
    id: 'PN00033',
    lastName: 'AMAYA',
    firstName: 'MA. JANICE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00034',
    lastName: 'MERANO',
    firstName: 'ANGELINE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00035',
    lastName: 'CAYABYAB',
    firstName: 'DANNA',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00036',
    lastName: 'LIQUIGAN',
    firstName: 'MICHAEL',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Male',
  },
  {
    id: 'PN00037',
    lastName: 'LUNA',
    firstName: 'AIRA MAE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
  {
    id: 'PN00038',
    lastName: 'LOPEZ',
    firstName: 'JEANY ROSE',
    academicYear: '2025-2026',
    type: 'Personnel',
    gender: 'Female',
  },
];

async function main() {
  console.log('Starting personnel seeding...');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const person of personnelData) {
    try {
      // Check if personnel already exists
      const existing = await prisma.students.findUnique({
        where: { student_id: person.id },
      });

      if (existing) {
        // Update if exists
        await prisma.students.update({
          where: { student_id: person.id },
          data: {
            type: UserType.PERSONNEL,
            first_name: person.firstName,
            last_name: person.lastName,
            grade_level: 0, // Personnel don't have grade levels
            section: 'PERSONNEL',
            barcode: person.id, // Use ID as barcode
            is_active: true,
          },
        });
        updated++;
        console.log(
          `✓ Updated: ${person.firstName} ${person.lastName} (${person.id})`,
        );
      } else {
        // Create new personnel record
        await prisma.students.create({
          data: {
            student_id: person.id,
            type: UserType.PERSONNEL,
            first_name: person.firstName,
            last_name: person.lastName,
            grade_level: 0, // Personnel don't have grade levels
            section: 'PERSONNEL',
            barcode: person.id, // Use ID as barcode
            is_active: true,
          },
        });
        created++;
        console.log(
          `✓ Created: ${person.firstName} ${person.lastName} (${person.id})`,
        );
      }
    } catch (error) {
      console.error(`✗ Error processing ${person.id}:`, error);
      skipped++;
    }
  }

  console.log('\n=== Personnel Seeding Complete ===');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${personnelData.length}`);
}

main()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
