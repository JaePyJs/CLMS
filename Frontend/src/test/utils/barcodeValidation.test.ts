import { describe, it, expect } from 'vitest'
import { barcodeValidation } from '@/lib/scanner'

describe('barcodeValidation', () => {
  describe('isStudentBarcode', () => {
    it('should return true for valid student barcodes', () => {
      expect(barcodeValidation.isStudentBarcode('STU001')).toBe(true)
      expect(barcodeValidation.isStudentBarcode('AB123')).toBe(true)
      expect(barcodeValidation.isStudentBarcode('123456')).toBe(true) // 6 digits
    })

    it('should return false for invalid student barcodes', () => {
      expect(barcodeValidation.isStudentBarcode('ABC')).toBe(false)
      expect(barcodeValidation.isStudentBarcode('')).toBe(false)
      expect(barcodeValidation.isStudentBarcode('123')).toBe(false)
      expect(barcodeValidation.isStudentBarcode('123456789')).toBe(false) // Too long, looks like ISBN
    })
  })

  describe('isBookBarcode', () => {
    it('should return true for valid book barcodes', () => {
      expect(barcodeValidation.isBookBarcode('9780123456789')).toBe(true)
      expect(barcodeValidation.isBookBarcode('1234567890123')).toBe(true)
    })

    it('should return false for invalid book barcodes', () => {
      expect(barcodeValidation.isBookBarcode('STU001')).toBe(false)
      expect(barcodeValidation.isBookBarcode('12345')).toBe(false)
    })
  })

  describe('isEquipmentBarcode', () => {
    it('should return true for valid equipment barcodes', () => {
      expect(barcodeValidation.isEquipmentBarcode('EQ001')).toBe(true)
      expect(barcodeValidation.isEquipmentBarcode('PC01')).toBe(true)
      expect(barcodeValidation.isEquipmentBarcode('PS02')).toBe(true)
      expect(barcodeValidation.isEquipmentBarcode('AVR01')).toBe(true)
    })

    it('should return false for invalid equipment barcodes', () => {
      expect(barcodeValidation.isEquipmentBarcode('STU001')).toBe(false)
      expect(barcodeValidation.isEquipmentBarcode('')).toBe(false)
    })
  })

  describe('getBarcodeType', () => {
    it('should return correct barcode type', () => {
      expect(barcodeValidation.getBarcodeType('STU001')).toBe('student')
      expect(barcodeValidation.getBarcodeType('9780123456789')).toBe('book')
      expect(barcodeValidation.getBarcodeType('EQ001')).toBe('equipment')
      expect(barcodeValidation.getBarcodeType('12345')).toBe('unknown') // Too short for student
    })
  })
})