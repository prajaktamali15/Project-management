import { NextRequest } from "next/server";
import { z } from "zod";
import { signAccessToken, verifyRefreshToken } from "@/lib/jwt";
import { ApiResponse } from "@/lib/api-response";

const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = RefreshSchema.parse(body);

    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({ userId: (payload as any).userId, email: (payload as any).email });

    return ApiResponse.success({ accessToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return ApiResponse.validationError(err.flatten());
    }
    return ApiResponse.unauthorized("Invalid token");
  }
}



