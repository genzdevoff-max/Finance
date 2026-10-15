import { notFound } from 'next/navigation';
import { getLoanById } from '@/lib/services/loans.service';
import { LoanDetailsView } from '@/components/loans/LoanDetailsView';
import { Header } from '@/components/shared/Header';
import { formatRupees } from '@/lib/utils/currency';

export const dynamic = 'force-dynamic';

interface LoanDetailPageProps {
  params: Promise<{
    loanId: string;
  }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function LoanDetailPage({ params, searchParams }: LoanDetailPageProps) {
  const [{ loanId }, query] = await Promise.all([params, searchParams]);
  const requestedPage = Number(query.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const loan = await getLoanById(loanId, page);

  if (!loan) {
    notFound();
  }

  return (
    <div>
      <Header
        title={`${loan.personName}'s Loan`}
        subtitle={`${formatRupees(loan.loanAmount)} • Status: ${loan.status}`}
        backHref={`/people/${loan.personId}`}
      />

      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <LoanDetailsView loan={loan} />
      </div>
    </div>
  );
}
