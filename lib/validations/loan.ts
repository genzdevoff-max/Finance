import { z } from 'zod';

export const loanSchema = z.object({
  personId: z.string().uuid({ message: 'Valid borrower selection is required' }),
  loanAmount: z
    .number({ invalid_type_error: 'Loan amount is required and must be a number' })
    .positive({ message: 'Loan amount must be greater than ₹0' })
    .max(100000000, { message: 'Loan amount is excessively large' }), // Up to ₹10 Crore
  loanDate: z
    .string()
    .min(1, { message: 'Loan date is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Loan date must be YYYY-MM-DD' }),
  dailyInstallment: z
    .number({ invalid_type_error: 'Expected daily installment must be a number' })
    .positive({ message: 'Daily installment must be greater than ₹0' })
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes must not exceed 500 characters' })
    .optional()
    .or(z.literal('')),
});

export type LoanFormData = z.infer<typeof loanSchema>;
