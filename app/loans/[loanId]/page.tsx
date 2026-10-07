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
}

export default async function LoanDetailPage({ params }: LoanDetailPageProps) {
  const { loanId } = await params;
  const loan = await getLoanById(loanId);

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

      <div className="p-4">
        <LoanDetailsView loan={loan} />
      </div>
    </div>
  );
}
