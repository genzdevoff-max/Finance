export const dynamic = 'force-dynamic';

interface ExportRouteContext {
  params: Promise<{ personId: string }>;
}

export async function GET(request: Request, { params }: ExportRouteContext) {
  const { personId } = await params;
  const exportUrl = new URL('/api/history/export', request.url);
  exportUrl.searchParams.set('personId', personId);
  return Response.redirect(exportUrl, 307);
}
