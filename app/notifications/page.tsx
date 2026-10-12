import { Header } from '@/components/shared/Header';
import { NotificationsView } from '@/components/notifications/NotificationsView';
import {
  getNotificationCount,
  getNotifications,
  getUnreadNotificationsCount,
} from '@/lib/services/notifications.service';

export const dynamic = 'force-dynamic';

interface NotificationsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams;
  const requestedPage = Number(params.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 50;
  const notifications = await getNotifications(pageSize, (page - 1) * pageSize);
  const [totalCount, unreadCount] = await Promise.all([
    getNotificationCount(),
    getUnreadNotificationsCount(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <div>
      <Header title="Notifications" subtitle={`${totalCount} total · newest first`} />
      <NotificationsView
        items={notifications}
        currentPage={page}
        totalPages={totalPages}
        unreadCount={unreadCount}
      />
    </div>
  );
}
