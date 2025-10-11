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
        const students = await prisma.student.findMany({
            where: { isActive: true },
            orderBy: { studentId: 'asc' },
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
                logger_1.logger.error(`Failed to generate QR for student ${student.studentId}: ${errorMessage}`);
                results.push({
                    studentId: student.studentId,
                    name: `${student.firstName} ${student.lastName}`,
                    qrPath: '',
                    qrUrl: '',
                    success: false,
                    error: errorMessage,
                });
            }
        }
        const summary = {
            totalStudents: students.length,
            successCount,
            errorCount,
            outputDir: this.qrDir,
            results,
            generatedAt: new Date().toISOString(),
        };
        const reportPath = path.join(this.qrDir, '_generation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
        logger_1.logger.info(`QR generation complete. Success: ${successCount}, Failed: ${errorCount}`);
        return summary;
    }
    async generateQRCodeForStudent(studentId) {
        const student = await prisma.student.findUnique({
            where: { id: studentId },
        });
        if (!student) {
            throw new Error('Student not found');
        }
        const qrData = student.studentId;
        const fileName = `${student.studentId}.png`;
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
        await prisma.student.update({
            where: { id: student.id },
            data: { barcodeImage: filePath },
        });
        return {
            studentId: student.studentId,
            name: `${student.firstName} ${student.lastName}`,
            qrPath: filePath,
            qrUrl: `/api/qr-codes/${student.studentId}.png`,
            success: true,
        };
    }
    async getQRCodeForStudent(studentId) {
        const student = await prisma.student.findFirst({
            where: { studentId },
        });
        if (!student || !student.barcodeImage) {
            return null;
        }
        return student.barcodeImage;
    }
    async getGenerationReport() {
        const reportPath = path.join(this.qrDir, '_generation-report.json');
        if (!fs.existsSync(reportPath)) {
            return null;
        }
        const reportData = fs.readFileSync(reportPath, 'utf-8');
        return JSON.parse(reportData);
    }
    getQRCodePath(studentId) {
        return path.join(this.qrDir, `${studentId}.png`);
    }
    qrCodeExists(studentId) {
        return fs.existsSync(this.getQRCodePath(studentId));
    }
    async deleteQRCode(studentId) {
        const filePath = this.getQRCodePath(studentId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            const student = await prisma.student.findFirst({
                where: { studentId },
            });
            if (student) {
                await prisma.student.update({
                    where: { id: student.id },
                    data: { barcodeImage: null },
                });
            }
            return true;
        }
        return false;
    }
    async regenerateQRCode(studentId) {
        await this.deleteQRCode(studentId);
        const student = await prisma.student.findFirst({
            where: { studentId },
        });
        if (!student) {
            throw new Error('Student not found');
        }
        return this.generateQRCodeForStudent(student.id);
    }
}
exports.QRCodeService = QRCodeService;
exports.qrCodeService = new QRCodeService();
//# sourceMappingURL=qrCodeService.js.map