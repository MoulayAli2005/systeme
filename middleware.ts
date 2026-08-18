import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const session = req.cookies.get("nexora_session");
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/app") && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/platform") && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/platform/:path*"],
};
