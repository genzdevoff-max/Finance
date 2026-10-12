import { Header } from '@/components/shared/Header';
import { LoanAlertsView } from '@/components/alerts/LoanAlertsView';
import { getLoanDueNotifications } from '@/lib/services/dashboard.service';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const alerts = await getLoanDueNotifications();

  return (
    <div>
      <Header title="Alerts" subtitle="Overdue and upcoming loan due dates" backHref="/dashboard" />
      <LoanAlertsView alerts={alerts} />
    </div>
  );
}
