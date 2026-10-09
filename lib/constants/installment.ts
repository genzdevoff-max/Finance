export const installmentFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

export type InstallmentFrequency = (typeof installmentFrequencies)[number];

export function installmentFrequencyLabel(frequency: InstallmentFrequency): string {
  switch (frequency) {
    case 'DAILY':
      return 'daily';
    case 'WEEKLY':
      return 'weekly';
    case 'MONTHLY':
      return 'monthly';
  }
}
