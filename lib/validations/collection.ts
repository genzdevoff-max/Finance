import { z } from 'zod';

export const collectionSchema = z.object({
  personId: z.string().uuid({ message: 'Valid person must be selected' }),
  loanId: z.string().uuid({ message: 'Valid loan must be selected' }),
  amount: z
    .number({ invalid_type_error: 'Amount is required and must be a valid number' })
    .positive({ message: 'Collection amount must be greater than ₹0' })
    .max(100000000, { message: 'Amount is excessively large' }),
  collectedAt: z.string().optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
});

export type CollectionFormData = z.infer<typeof collectionSchema>;
