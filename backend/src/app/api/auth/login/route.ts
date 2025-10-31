import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/hash";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, password: true },
    });
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email });

    return new Response(JSON.stringify({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    }), { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}



