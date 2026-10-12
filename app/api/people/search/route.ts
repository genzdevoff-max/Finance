import { getPeopleListPage } from '@/lib/services/people.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return Response.json({ people: [] });

  try {
    const result = await getPeopleListPage(query, 1, 10);
    return Response.json(
      {
        people: result.items.map(({ id, fullName, phone }) => ({ id, fullName, phone })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Failed to search people for dashboard:', error);
    return Response.json({ error: 'Unable to search people.' }, { status: 500 });
  }
}
