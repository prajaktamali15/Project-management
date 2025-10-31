import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return new Response(JSON.stringify({ error: "email parameter required" }), { status: 400 });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: email,
          mode: "insensitive"
        }
      },
      take: 10,
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    return new Response(JSON.stringify({ users }), { status: 200 });
  } catch (err) {
    console.error("Error searching users:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
