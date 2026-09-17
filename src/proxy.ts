import { NextRequest, NextResponse } from "next/server";

const locales = ["zh-CN", "en"];
const protectedPath = /^\/(zh-CN|en)\/(?:studio|settings|admin)(?:\/|$)/;

function hasSessionCookie(request: NextRequest) {
  return request.cookies.has("kc_access") || request.cookies.has("kc_refresh");
}

function isRouterPrefetch(request: NextRequest) {
  return request.headers.has("next-router-prefetch") || request.headers.get("x-middleware-prefetch") === "1";
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const locale = pathname.split("/")[1];
  const response = NextResponse.redirect(new URL(`/${locale}/login?next=${encodeURIComponent(pathname)}`, request.url));
  // Keep unauthenticated bounces out of the App Router prefetch cache.
  // 未登录回跳不得进入 App Router 预取缓存。
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") return NextResponse.redirect(new URL("/zh-CN", request.url));
  if (pathname.startsWith("/_next") || pathname.includes(".")) return NextResponse.next();
  const hasLocale = locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  if (!hasLocale) return NextResponse.redirect(new URL(`/zh-CN${pathname}`, request.url));
  if (protectedPath.test(pathname) && !hasSessionCookie(request)) {
    // Prefetch of a gated route must not cache a 307 back to the current login URL.
    // 受保护路由的预取不能把 307 缓存成当前登录页。
    if (isRouterPrefetch(request)) {
      return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
    }
    return redirectToLogin(request, pathname);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
