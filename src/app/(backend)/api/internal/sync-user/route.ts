import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const expected = process.env.SUB2API_INTERNAL_SECRET;
  if (!expected || req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const sub2apiUserId = String(body?.user_id || '').trim();
  if (!sub2apiUserId) {
    return NextResponse.json({ error: 'missing user_id' }, { status: 400 });
  }

  const { findLobeUserIdBySub2ApiUserId, provisionFromSub2Api } =
    await import('@/libs/auth/sub2api-provision');
  const lobeUserId = await findLobeUserIdBySub2ApiUserId(sub2apiUserId);
  if (!lobeUserId) {
    return NextResponse.json({ ok: true, skipped: 'user not found' });
  }

  await provisionFromSub2Api(lobeUserId, sub2apiUserId);
  return NextResponse.json({ ok: true });
}
