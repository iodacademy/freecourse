import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rute API yang tidak butuh Authorization header
const PUBLIC_API_ROUTES = [
  '/api/auth/verify',
  '/api/auth/admin-login',
  '/api/partner-codes/validate',
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

    // Cek keberadaan header Authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
