import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // CORS: restrict to allowed origins if provided; otherwise default to localhost dev origins
  const allowed = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:4000").split(/[,\s]+/).filter(Boolean);
  const origin = req.headers.get("origin");
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];

  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  // Auth guard: require Bearer token for API routes except auth endpoints
  const pathname = req.nextUrl.pathname || "";
  const isAuthRoute = pathname.startsWith("/api/auth/");
  if (!isAuthRoute) {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: res.headers });
    }
  }

  return res;
}

export const config = {
  matcher: "/api/:path*",
};



