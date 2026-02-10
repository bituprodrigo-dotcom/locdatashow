import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  // Verificar autenticação
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuth = !!token;

  // Rotas que exigem autenticação
  const isProtectedRoute = 
    req.nextUrl.pathname.startsWith("/dashboard") || 
    req.nextUrl.pathname.startsWith("/my-reservations");

  if (isProtectedRoute && !isAuth) {
    let from = req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(from)}`, req.url)
    );
  }

  const response = NextResponse.next();

  // Adicionar headers de Cache-Control para rotas do dashboard (Prevenir Back-Forward Cache)
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/my-reservations/:path*"],
};
