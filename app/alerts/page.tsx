import { Header } from '@/components/shared/Header';
import { LoanAlertsView } from '@/components/alerts/LoanAlertsView';
import { getLoanDueNotifications } from '@/lib/services/dashboard.service';

export const dynamic = 'force-dynamic';

interface AlertsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const params = await searchParams;
  const requestedPage = Number(params.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const alerts = await getLoanDueNotifications(page, 50);

  return (
    <div>
      <Header title="Alerts" subtitle="Overdue and upcoming loan due dates" backHref="/dashboard" />
      <LoanAlertsView
        alerts={alerts.items}
        currentPage={alerts.currentPage}
        totalPages={alerts.totalPages}
        totalCount={alerts.totalCount}
      />
    </div>
  );
}
