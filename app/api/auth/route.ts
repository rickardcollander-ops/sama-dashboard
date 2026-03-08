import { NextRequest, NextResponse } from 'next/server';

async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret + '_sama_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const secret = process.env.MISSION_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'MISSION_SECRET not configured' }, { status: 500 });
  }

  if (password === secret) {
    const hashed = await hashSecret(secret);
    const res = NextResponse.json({ ok: true });
    res.cookies.set('sama_auth', hashed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('sama_auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
