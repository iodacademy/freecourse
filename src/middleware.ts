import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_API_ROUTES = [
  '/api/auth/verify',
  '/api/auth/admin-login',
  '/api/partner-codes/validate',
  '/api/forms/active',
  '/api/events/public',   // Landing page workshop/beasiswa — tidak butuh auth
  '/api/health',          // Diagnostic endpoint
  '/api/profile/update',  // Profile update — auth via body token (Hostinger compat)
  '/api/verify',          // Verifikasi sertifikat — publik
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteksi Dasar untuk Rute API
  if (pathname.startsWith('/api/')) {
    // Lewati rute publik
    if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Cek keberadaan header Authorization ATAU X-Firebase-Token (fallback)
    // Hostinger strip header Authorization, jadi kita juga cek X-Firebase-Token
    const authHeader = request.headers.get('Authorization');
    const fallbackToken = request.headers.get('X-Firebase-Token');
    
    if ((!authHeader || !authHeader.startsWith('Bearer ')) && !fallbackToken) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
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
