import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { ApiResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return ApiResponse.unauthorized();

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return ApiResponse.badRequest("email parameter required");
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

    return ApiResponse.success({ users });
  } catch (err) {
    console.error("Error searching users:", err);
    return ApiResponse.error("Internal Server Error");
  }
}
