'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { personSchema, type PersonFormData } from '@/lib/validations/person';
import { createPersonAction, updatePersonAction } from '@/app/actions/people.actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface PersonFormProps {
  personId?: string;
  initialData?: {
    fullName: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  };
}

export function PersonForm({ personId, initialData }: PersonFormProps) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      fullName: initialData?.fullName || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      notes: initialData?.notes || '',
    },
  });

  const onSubmit = async (data: PersonFormData) => {
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (personId) {
        const res = await updatePersonAction(personId, data);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to update person');
          setIsSubmitting(false);
          return;
        }
        router.push(`/people/${personId}`);
      } else {
        const res = await createPersonAction(data);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to add person');
          setIsSubmitting(false);
          return;
        }
        router.push(res.person ? `/people/${res.person.id}` : '/people');
      }
    } catch {
      setErrorMsg('Something went wrong. Please check details and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-white p-5 shadow-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        <Input
          label="Full Name *"
          placeholder="e.g. Ramesh Kumar"
          {...register('fullName')}
          error={errors.fullName?.message}
          autoFocus
        />

        <Input
          label="Phone Number"
          type="tel"
          placeholder="e.g. +91 98765 43210"
          {...register('phone')}
          error={errors.phone?.message}
          hint="Optional. Used for quick reference and search."
        />

        <div className="space-y-1.5">
          <label htmlFor="address" className="block text-sm font-semibold text-slate-700">
            Address / Shop Location
          </label>
          <textarea
            id="address"
            rows={2}
            placeholder="e.g. Shop #12, Main Market"
            className="flex w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            {...register('address')}
          />
          {errors.address?.message && (
            <p className="text-xs font-medium text-rose-600">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-semibold text-slate-700">
            Notes
          </label>
          <textarea
            id="notes"
            rows={2}
            placeholder="e.g. Morning vegetable market vendor"
            className="flex w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            {...register('notes')}
          />
          {errors.notes?.message && (
            <p className="text-xs font-medium text-rose-600">{errors.notes.message}</p>
          )}
        </div>

        <div className="pt-2 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-1/3"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" className="w-2/3" isLoading={isSubmitting}>
            {personId ? 'Save Changes' : 'Save Person'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
