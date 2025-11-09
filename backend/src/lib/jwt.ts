import jwt, { SignOptions } from "jsonwebtoken";

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET", devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  // In production, secrets must be set
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production environment`);
  }
  // In development, use a stable fallback to avoid breaking local runs
  return devFallback;
}

const ACCESS_SECRET = getSecret("JWT_ACCESS_SECRET", "dev-access-secret");
const REFRESH_SECRET = getSecret("JWT_REFRESH_SECRET", "dev-refresh-secret");

export type JwtPayload = {
  userId: string;
  email: string;
  role?: string;
};

export function signAccessToken(payload: JwtPayload, expiresIn: string | number = "15m"): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn } as SignOptions);
}

export function signRefreshToken(payload: JwtPayload, expiresIn: string | number = "7d"): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn } as SignOptions);
}

export function verifyAccessToken<T extends object = JwtPayload>(token: string): T {
  return jwt.verify(token, ACCESS_SECRET) as T;
}

export function verifyRefreshToken<T extends object = JwtPayload>(token: string): T {
  return jwt.verify(token, REFRESH_SECRET) as T;
}



