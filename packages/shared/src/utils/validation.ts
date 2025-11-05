import { z } from 'zod';

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8);

export const validateEmail = (email: string): boolean => {
  return emailSchema.safeParse(email).success;
};

export const validatePassword = (password: string): boolean => {
  return passwordSchema.safeParse(password).success;
};