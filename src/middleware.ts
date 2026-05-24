import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_API_ROUTES = [
  '/api/auth/verify',
  '/api/auth/admin-login',
  '/api/partner-codes/validate',
  '/api/forms/active',
  '/api/events/public',   // Landing page workshop/beasiswa — tidak butuh auth
  '/api/health',          // Diagnostic endpoint
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteksi Dasar untuk Rute API
  if (pathname.startsWith('/api/')) {
    // Lewati rute publik
    if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.next();
    }
    
    // Rute verifikasi sertifikat publik: /api/verify/[certId]
    if (pathname.startsWith('/api/verify/')) {
      return NextResponse.next();
    }

    // Cek keberadaan header Authorization ATAU X-Firebase-Token (fallback)
    // Hostinger dan beberapa hosting lain strip header Authorization
    const authHeader = request.headers.get('Authorization');
    const fallbackToken = request.headers.get('X-Firebase-Token');
    
    const hasAuth = (authHeader && authHeader.startsWith('Bearer '));
    const hasFallback = !!fallbackToken;

    if (!hasAuth && !hasFallback) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Jika Authorization header di-strip tapi X-Firebase-Token ada,
    // reconstruct Authorization header agar route handler tetap bisa baca
    if (!hasAuth && hasFallback) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('Authorization', `Bearer ${fallbackToken}`);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
    
    // Note: Validasi token JWT Firebase (termasuk Role check) dilakukan di 
    // masing-masing route handler menggunakan Admin SDK (lib/api-helpers.ts) 
    // karena middleware berjalan di Edge Runtime yang tidak mendukung 
    // modul Node.js yang dipakai Firebase Admin SDK.
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
