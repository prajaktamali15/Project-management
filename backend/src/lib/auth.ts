import { headers } from "next/headers";
import { verifyAccessToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

export async function getAuthenticatedUser() {
  const hdrs = await headers();
  const auth = hdrs.get("authorization") || hdrs.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken<{ userId: string }>(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    return user;
  } catch {
    return null;
  }
}



