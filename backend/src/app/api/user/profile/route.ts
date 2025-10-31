import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z.string().max(500).nullable().optional()
  ),
  avatar: z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z.string().nullable().optional()
  ),
});

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    // Use findUnique with proper error handling
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

    // Return only safe fields (exclude password)
    const safeUser = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar,
      bio: userData.bio ?? null, // Handle case where bio might not exist yet
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    };

    return new Response(JSON.stringify({ user: safeUser }), { status: 200 });
  } catch (err: any) {
    console.error("Profile fetch error:", err);
    // Return more specific error in development
    const errorMsg = process.env.NODE_ENV === "development" ? err?.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const data = UpdateProfileSchema.parse(await req.json());
    
    // Build update data, only including fields that are provided
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.bio !== undefined) updateData.bio = data.bio;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return new Response(JSON.stringify({ user: updated }), { status: 200 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const errorDetails = err.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return new Response(JSON.stringify({ error: `Validation failed: ${errorDetails}` }), { status: 400 });
    }
    console.error("Profile update error:", err);
    const errorMsg = process.env.NODE_ENV === "development" ? err?.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
  }
}

