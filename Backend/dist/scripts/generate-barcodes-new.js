#!/usr/bin/env tsx
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const barcodeService_1 = require("../src/services/barcodeService");
const logger_1 = require("../src/utils/logger");
async function main() {
    logger_1.logger.info('🚀 Starting barcode generation for all active students...\n');
    const barcodeService = new barcodeService_1.BarcodeService();
    try {
        const summary = await barcodeService.generateBarcodesForAllStudents();
        console.log('\n' + '='.repeat(60));
        console.log('📊 BARCODE GENERATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`📁 Output Directory: ${summary.outputDir}`);
        console.log(`👥 Total Students: ${summary.totalStudents}`);
        console.log(`✅ Successful: ${summary.success_count}`);
        console.log(`❌ Errors: ${summary.errorCount}`);
        console.log(`🕒 Generated At: ${new Date(summary.generated_at).toLocaleString()}`);
        console.log('='.repeat(60));
        if (summary.errorCount > 0) {
            console.log('\n❌ ERRORS:\n');
            summary.results
                .filter(r => !r.success)
                .forEach(result => {
                console.log(`  • ${result.student_id} - ${result.name}: ${result.error}`);
            });
        }
        console.log('\n📄 Files Generated:');
        console.log(`  • ${summary.success_count} barcode PNG files`);
        console.log(`  • 1 generation report JSON file`);
        console.log(`  • 1 printable HTML sheet (index.html)`);
        console.log('\n🎯 Next Steps:');
        console.log(`  1. View barcodes: Open ${summary.outputDir}`);
        console.log(`  2. Print barcodes: Open ${summary.outputDir}/index.html`);
        console.log('  3. Use compressed mode: Click "Toggle Compressed Mode" before printing');
        console.log('  4. Scan barcodes: Use your USB scanner on the Scan tab\n');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Failed to generate barcodes', error);
        console.error('\n❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=generate-barcodes-new.js.map