"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrCodeService = exports.QRCodeService = void 0;
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const qrcode_1 = __importDefault(require("qrcode"));
const logger_1 = require("@/utils/logger");
const prisma = new client_1.PrismaClient();
class QRCodeService {
    qrDir;
    constructor() {
        this.qrDir = path.join(process.cwd(), 'qr-codes', 'students');
        this.ensureDirectoryExists();
    }
    ensureDirectoryExists() {
        if (!fs.existsSync(this.qrDir)) {
            fs.mkdirSync(this.qrDir, { recursive: true });
            logger_1.logger.info(`Created QR codes directory: ${this.qrDir}`);
        }
    }
    async generateQRCodesForAllStudents() {
        logger_1.logger.info('Starting QR code generation for all students');
        const students = await prisma.students.findMany({
            where: { is_active: true },
            orderBy: { student_id: 'asc' },
        });
        logger_1.logger.info(`Found ${students.length} active students`);
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        for (const student of students) {
            try {
                const result = await this.generateQRCodeForStudent(student.id);
                results.push(result);
                if (result.success) {
                    successCount++;
                }
                else {
                    errorCount++;
                }
            }
            catch (error) {
                errorCount++;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger_1.logger.error(`Failed to generate QR for student ${student.student_id}: ${error_message}`);
                results.push({
                    student_id: student.student_id,
                    name: `${student.first_name} ${student.last_name}`,
                    qrPath: '',
                    qrUrl: '',
                    success: false,
                    error: error_message,
                });
            }
        }
        const summary = {
            totalStudents: students.length,
            success_count,
            errorCount,
            outputDir: this.qrDir,
            results,
            generated_at: new Date().toISOString(),
        };
        const reportPath = path.join(this.qrDir, '_generation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
        logger_1.logger.info(`QR generation complete. Success: ${success_count}, Failed: ${errorCount}`);
        return summary;
    }
    async generateQRCodeForStudent(student_id) {
        const student = await prisma.students.findUnique({
            where: { id: student_id },
        });
        if (!student) {
            throw new Error('Student not found');
        }
        const qrData = student.student_id;
        const fileName = `${student.student_id}.png`;
        const filePath = path.join(this.qrDir, fileName);
        await qrcode_1.default.toFile(filePath, qrData, {
            type: 'png',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
            errorCorrectionLevel: 'H',
        });
        await prisma.students.update({
            where: { id: student.id },
            data: { id: crypto.randomUUID(), updated_at: new Date(), barcode_image: filePath },
        });
        return {
            student_id: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            qrPath: filePath,
            qrUrl: `/api/qr-codes/${student.student_id}.png`,
            success: true,
        };
    }
    async getQRCodeForStudent(student_id) {
        const student = await prisma.students.findFirst({
            where: { student_id },
        });
        if (!student || !student.barcode_image) {
            return null;
        }
        return student.barcode_image;
    }
    async getGenerationReport() {
        const reportPath = path.join(this.qrDir, '_generation-report.json');
        if (!fs.existsSync(reportPath)) {
            return null;
        }
        const reportData = fs.readFileSync(reportPath, 'utf-8');
        return JSON.parse(reportData);
    }
    getQRCodePath(student_id) {
        return path.join(this.qrDir, `${student_id}.png`);
    }
    qrCodeExists(student_id) {
        return fs.existsSync(this.getQRCodePath(student_id));
    }
    async deleteQRCode(student_id) {
        const filePath = this.getQRCodePath(student_id);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            const student = await prisma.students.findFirst({
                where: { student_id },
            });
            if (student) {
                await prisma.students.update({
                    where: { id: student.id },
                    data: { id: crypto.randomUUID(), updated_at: new Date(), barcode_image: null },
                });
            }
            return true;
        }
        return false;
    }
    async regenerateQRCode(student_id) {
        await this.deleteQRCode(student_id);
        const student = await prisma.students.findFirst({
            where: { student_id },
        });
        if (!student) {
            throw new Error('Student not found');
        }
        return this.generateQRCodeForStudent(student.id);
    }
}
exports.QRCodeService = QRCodeService;
exports.qrCodeService = new QRCodeService();
