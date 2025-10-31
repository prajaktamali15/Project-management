import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Clear auth tokens from client (they should redirect to login)
    return new Response(JSON.stringify({ message: "Account deleted successfully" }), { status: 200 });
  } catch (err) {
    console.error("Account deletion error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}


