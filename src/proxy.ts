import { NextRequest, NextResponse } from "next/server";

const locales = ["zh-CN", "en"];
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") return NextResponse.redirect(new URL("/zh-CN", request.url));
  if (pathname.startsWith("/_next") || pathname.includes(".")) return NextResponse.next();
  const hasLocale = locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  if (!hasLocale) return NextResponse.redirect(new URL(`/zh-CN${pathname}`, request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
