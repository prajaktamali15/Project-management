import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/hash";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { ApiResponse } from "@/lib/api-response";

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
      return ApiResponse.unauthorized("Invalid credentials");
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return ApiResponse.unauthorized("Invalid credentials");
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email });

    return ApiResponse.success({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return ApiResponse.validationError(err.flatten());
    }
    return ApiResponse.error("Internal Server Error");
  }
}



