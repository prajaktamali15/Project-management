import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New password and confirm password must match",
  path: ["confirmPassword"],
});

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const data = ChangePasswordSchema.parse(await req.json());

    // Get user with password hash
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true },
    });

    if (!userWithPassword) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

    // Verify current password
    const isValid = await bcrypt.compare(data.currentPassword, userWithPassword.password);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Current password is incorrect" }), { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return new Response(JSON.stringify({ message: "Password updated successfully" }), { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    }
    console.error("Password change error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}


