import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const secret = process.env.MISSION_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'MISSION_SECRET not configured' }, { status: 500 });
  }

  if (password === secret) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('sama_auth', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
}
