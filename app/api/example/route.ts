import { emptyDesk, evaluate } from '@/lib/desk';
export function GET(request: Request) {
  const url = new URL(request.url),
    desk = emptyDesk(true);
  if (url.searchParams.get('policy') === 'addition')
    desk.policy.substitution = 'confirm';
  return Response.json(
    evaluate(desk, {
      action: 'checkout',
      borrower: 'ari',
      kit: 'kit-02',
      requestedKit: 'kit-01',
      confirmed: url.searchParams.get('confirmed') === 'true',
    }),
  );
}
