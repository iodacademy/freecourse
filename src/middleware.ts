import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_API_ROUTES = [
  '/api/auth/verify',
  '/api/auth/admin-login',
  '/api/partner-codes/validate',
  '/api/forms/active',
  '/api/forms/resolve',
  '/api/events/public',
  '/api/profile/update',
  '/api/verify',
  '/api/public/dashboard',
  '/api/public/mitra',
  '/api/public/standalone',
  '/api/public/meta',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    const authHeader = request.headers.get('Authorization');
    const fallbackToken = request.headers.get('X-Firebase-Token');

    if ((!authHeader || !authHeader.startsWith('Bearer ')) && !fallbackToken) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
