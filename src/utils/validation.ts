import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email format');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const amountSchema = z
  .number()
  .min(5, 'Minimum purchase amount is $5.00')
  .max(10000, 'Maximum purchase amount is $10,000.00');

export const keyNameSchema = z
  .string()
  .min(1, 'Key name is required')
  .max(100, 'Key name must be at most 100 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Key name must contain only letters, numbers, dashes, and underscores');

export const creditLimitSchema = z
  .number()
  .min(0, 'Credit limit must be >= 0')
  .nullable();

export const limitResetSchema = z
  .enum(['daily', 'weekly', 'monthly'])
  .nullable();

export const thresholdSchema = z
  .number()
  .min(1, 'Threshold must be >= $1.00')
  .max(1000, 'Threshold must be <= $1,000.00');
