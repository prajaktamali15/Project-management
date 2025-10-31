import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("avatar");

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
    }

    // Validate file type (images only)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: "Only image files are allowed (JPEG, PNG, GIF, WebP)" }), { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File size must be less than 5MB" }), { status: 400 });
    }

    // Create uploads directory for user avatars
    const uploadsRoot = path.join(process.cwd(), "public", "uploads", "avatars");
    await fs.mkdir(uploadsRoot, { recursive: true });

    // Generate unique filename: userId_timestamp.extension
    const ext = path.extname(file.name);
    const timestamp = Date.now();
    const fileName = `${user.id}_${timestamp}${ext}`;
    const destPath = path.join(uploadsRoot, fileName);

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuffer));

    // Public URL
    const publicUrl = `/uploads/avatars/${fileName}`;

    // Update user avatar in database
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar: publicUrl },
    });

    return new Response(JSON.stringify({ url: publicUrl }), { status: 200 });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}


