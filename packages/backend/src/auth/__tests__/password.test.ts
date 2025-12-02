import { describe, it, expect } from 'vitest';
import { PasswordService } from '../password';

describe('PasswordService', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'TestPassword123!';
      const hash = await PasswordService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await PasswordService.hashPassword(password);
      const hash2 = await PasswordService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for password shorter than 6 characters', async () => {
      await expect(PasswordService.hashPassword('12345')).rejects.toThrow(
        'Password must be at least 6 characters long'
      );
    });

    it('should throw error for empty password', async () => {
      await expect(PasswordService.hashPassword('')).rejects.toThrow(
        'Password must be at least 6 characters long'
      );
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await PasswordService.hashPassword(password);
      
      const isValid = await PasswordService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await PasswordService.hashPassword(password);
      
      const isValid = await PasswordService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should return false for empty password', async () => {
      const hash = await PasswordService.hashPassword('TestPassword123!');
      
      const isValid = await PasswordService.verifyPassword('', hash);
      expect(isValid).toBe(false);
    });

    it('should return false for empty hash', async () => {
      const isValid = await PasswordService.verifyPassword('TestPassword123!', '');
      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const isValid = await PasswordService.verifyPassword('TestPassword123!', 'invalid-hash');
      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const result = PasswordService.validatePasswordStrength('StrongPass123!');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password without lowercase letter', () => {
      const result = PasswordService.validatePasswordStrength('STRONGPASS123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without uppercase letter', () => {
      const result = PasswordService.validatePasswordStrength('strongpass123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without number', () => {
      const result = PasswordService.validatePasswordStrength('StrongPass!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = PasswordService.validatePasswordStrength('StrongPass123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject password shorter than 8 characters', () => {
      const result = PasswordService.validatePasswordStrength('Pass1!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password longer than 128 characters', () => {
      // Create a password that meets all requirements except length
      const longPassword = 'A'.repeat(60) + 'a'.repeat(60) + '123456789!'; // 130 characters
      const result = PasswordService.validatePasswordStrength(longPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Password must be less than 128 characters long');
    });

    it('should reject common weak passwords', () => {
      const weakPasswords = ['password', '123456', 'qwerty', 'password123'];
      
      weakPasswords.forEach(password => {
        const result = PasswordService.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common, please choose a stronger password');
      });
    });

    it('should reject empty password', () => {
      const result = PasswordService.validatePasswordStrength('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should accumulate multiple validation errors', () => {
      const result = PasswordService.validatePasswordStrength('weak');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = PasswordService.generateSecurePassword();
      
      expect(password).toBeDefined();
      expect(password.length).toBe(16);
    });

    it('should generate password with custom length', () => {
      const customLength = 24;
      const password = PasswordService.generateSecurePassword(customLength);
      
      expect(password.length).toBe(customLength);
    });

    it('should generate password that passes strength validation', () => {
      const password = PasswordService.generateSecurePassword();
      const validation = PasswordService.validatePasswordStrength(password);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should generate different passwords each time', () => {
      const password1 = PasswordService.generateSecurePassword();
      const password2 = PasswordService.generateSecurePassword();
      
      expect(password1).not.toBe(password2);
    });

    it('should contain at least one character from each required category', () => {
      const password = PasswordService.generateSecurePassword();
      
      expect(/[a-z]/.test(password)).toBe(true); // lowercase
      expect(/[A-Z]/.test(password)).toBe(true); // uppercase
      expect(/\d/.test(password)).toBe(true); // number
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true); // special char
    });

    it('should handle minimum length requirements', () => {
      // Test with length less than 4 (minimum to include all character types)
      const password = PasswordService.generateSecurePassword(8);
      
      expect(password.length).toBe(8);
      
      const validation = PasswordService.validatePasswordStrength(password);
      expect(validation.isValid).toBe(true);
    });
  });
});