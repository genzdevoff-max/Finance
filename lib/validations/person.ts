import { z } from 'zod';

export const personSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  phone: z
    .string()
    .trim()
    .max(20, { message: 'Phone number is too long' })
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .max(300, { message: 'Address must not exceed 300 characters' })
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
});

export type PersonFormData = z.infer<typeof personSchema>;
