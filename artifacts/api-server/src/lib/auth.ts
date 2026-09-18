import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";

export const sessionCookieName = "kisan_session";
const sessionSecretValue = process.env.SESSION_SECRET ?? process.env.JWT_SECRET;

if (!sessionSecretValue) {
  throw new Error("SESSION_SECRET must be configured before starting the API server.");
}
const sessionSecret: string = sessionSecretValue;

type SessionPayload = {
  farmerId: string;
};

declare global {
  namespace Express {
    interface Request {
      farmerId?: string;
    }
  }
}

export function issueSession(farmerId: string): string {
  return jwt.sign({ farmerId } satisfies SessionPayload, sessionSecret, {
    expiresIn: "7d",
  });
}

export function setSessionCookie(res: Response, farmerId: string): void {
  res.cookie(sessionCookieName, issueSession(farmerId), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });
}

export const authenticate: RequestHandler = (req, res, next) => {
  const token = req.cookies?.[sessionCookieName];
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const payload = jwt.verify(token, sessionSecret) as SessionPayload;
    if (!payload?.farmerId) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    req.farmerId = payload.farmerId;
    next();
  } catch {
    res.status(401).json({ error: "Authentication required." });
  }
};

export function requireFarmer(req: Request, res: Response): string | null {
  if (!req.farmerId) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }
  return req.farmerId;
}

export function handleRouteError(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  req.log.error({ err: error }, "Request failed");
  res.status(500).json({ error: "Something went wrong. Please try again." });
}