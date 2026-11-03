import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";

const cookieName = "nasaem_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 30;

function sessionSecret(): string {
  const configured = process.env.NASAEM_SESSION_SECRET;
  if (configured) return configured;

  const dataDir =
    process.env.NASAEM_DATA_DIR ?? path.resolve(process.cwd(), "nasaem-data");
  mkdirSync(dataDir, { recursive: true });
  const secretPath = path.join(dataDir, ".session-secret");
  if (!existsSync(secretPath)) {
    const candidate = randomBytes(32).toString("base64url");
    try {
      writeFileSync(secretPath, candidate, { encoding: "utf8", flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
    }
  }
  return readFileSync(secretPath, "utf8").trim();
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function readCookie(req: Request): string | undefined {
  const entry = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(cookieName.length + 1));
  } catch {
    return undefined;
  }
}

export function getLocalSessionUserId(req: Request): string | undefined {
  const token = readCookie(req);
  if (!token) return undefined;
  const [encodedUserId, expiresRaw, signature, extra] = token.split(".");
  if (!encodedUserId || !expiresRaw || !signature || extra) return undefined;

  const payload = `${encodedUserId}.${expiresRaw}`;
  const expected = Buffer.from(sign(payload), "base64url");
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return undefined;
  }

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return undefined;
  }
  try {
    return decodeURIComponent(encodedUserId);
  } catch {
    return undefined;
  }
}

export function setLocalSession(req: Request, res: Response, userId: string): void {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  const payload = `${encodeURIComponent(userId)}.${expiresAt}`;
  const value = encodeURIComponent(`${payload}.${sign(payload)}`);
  const secure = req.secure ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetimeSeconds}${secure}`,
  );
}

export function clearLocalSession(req: Request, res: Response): void {
  const secure = req.secure ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
}
