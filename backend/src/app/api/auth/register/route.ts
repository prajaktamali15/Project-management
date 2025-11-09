import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/hash";
import { ApiResponse } from "@/lib/api-response";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = RegisterSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return ApiResponse.error("Email already in use", 409);
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return ApiResponse.created({ user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return ApiResponse.validationError(err.flatten());
    }
    return ApiResponse.error("Internal Server Error");
  }
}



