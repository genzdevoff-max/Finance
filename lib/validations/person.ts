import { z } from 'zod';

export const personSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' })
    .max(100, { message: 'Full name must not exceed 100 characters' })
    .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/, {
      message: 'Enter the name using English letters',
    }),
  work: z
    .string()
    .trim()
    .max(100, { message: 'Work must not exceed 100 characters' })
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(20, { message: 'Phone number is too long' })
    .refine(
      (value) =>
        value.length === 0 ||
        (/^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7),
      { message: 'Enter a valid phone number' }
    )
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
