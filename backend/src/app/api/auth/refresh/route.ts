import { NextRequest } from "next/server";
import { z } from "zod";
import { signAccessToken, verifyRefreshToken } from "@/lib/jwt";

const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = RefreshSchema.parse(body);

    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({ userId: (payload as any).userId, email: (payload as any).email });

    return new Response(JSON.stringify({ accessToken }), { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }
}



