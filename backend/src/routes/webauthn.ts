import { Router, type IRouter } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransport,
} from "@simplewebauthn/server";
import { db, usersTable, webauthnCredentialsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { generateToken, requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

const pendingChallenges = new Map<number, { challenge: string; expiresAt: number }>();
const loginChallenges = new Map<string, { challenge: string; userId: number; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingChallenges) if (v.expiresAt < now) pendingChallenges.delete(k);
  for (const [k, v] of loginChallenges) if (v.expiresAt < now) loginChallenges.delete(k);
}, 60_000);

function getRpId(req: AuthenticatedRequest): string {
  const origin = (req.headers.origin as string) || (req.headers.referer as string) || "http://localhost";
  try { return new URL(origin).hostname; } catch { return "localhost"; }
}

function getOrigin(req: AuthenticatedRequest): string {
  return (req.headers.origin as string) || "http://localhost";
}

function toBase64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

function fromBase64url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

router.get("/auth/webauthn/credentials", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const creds = await db.select().from(webauthnCredentialsTable).where(eq(webauthnCredentialsTable.userId, req.userId!));
  res.json({
    registered: creds.length > 0,
    count: creds.length,
    devices: creds.map(c => ({ id: c.id, deviceType: c.deviceType, createdAt: c.createdAt })),
  });
});

router.post("/auth/webauthn/register/options", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const existingCreds = await db.select().from(webauthnCredentialsTable).where(eq(webauthnCredentialsTable.userId, user.id));
  const rpID = getRpId(req);

  const options = await generateRegistrationOptions({
    rpName: "BéninExpense",
    rpID,
    userID: new Uint8Array(Buffer.from(String(user.id))),
    userName: user.email,
    userDisplayName: user.companyName,
    attestationType: "none",
    excludeCredentials: existingCreds.map(c => ({ id: c.credentialId, transports: ["internal" as AuthenticatorTransport] })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      requireResidentKey: false,
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  pendingChallenges.set(user.id, { challenge: options.challenge, expiresAt: Date.now() + 5 * 60_000 });
  res.json(options);
});

router.post("/auth/webauthn/register/verify", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const pending = pendingChallenges.get(req.userId!);
  if (!pending || pending.expiresAt < Date.now()) {
    res.status(400).json({ error: "Challenge expired or not found" }); return;
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: pending.challenge,
      expectedOrigin: getOrigin(req),
      expectedRPID: getRpId(req),
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Verification failed" }); return;
    }

    const { credential } = verification.registrationInfo;
    pendingChallenges.delete(req.userId!);

    await db.insert(webauthnCredentialsTable).values({
      userId: req.userId!,
      credentialId: credential.id,
      publicKey: toBase64url(credential.publicKey),
      counter: credential.counter,
      deviceType: verification.registrationInfo.credentialDeviceType ?? "unknown",
    }).onConflictDoUpdate({
      target: webauthnCredentialsTable.credentialId,
      set: {
        publicKey: toBase64url(credential.publicKey),
        counter: credential.counter,
      },
    });

    res.json({ verified: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: msg });
  }
});

router.post("/auth/webauthn/login/options", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Email invalide" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user) { res.status(404).json({ error: "Aucun identifiant biométrique pour cet email" }); return; }

  const credentials = await db.select().from(webauthnCredentialsTable).where(eq(webauthnCredentialsTable.userId, user.id));
  if (credentials.length === 0) { res.status(404).json({ error: "Aucun identifiant biométrique enregistré" }); return; }

  const rpID = getRpId(req as AuthenticatedRequest);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map(c => ({ id: c.credentialId, transports: ["internal" as AuthenticatorTransport] })),
    userVerification: "required",
  });

  loginChallenges.set(parsed.data.email, {
    challenge: options.challenge,
    userId: user.id,
    expiresAt: Date.now() + 5 * 60_000,
  });
  res.json(options);
});

router.post("/auth/webauthn/login/verify", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email(), response: z.any() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }

  const { email, response: authResponse } = parsed.data;
  const pending = loginChallenges.get(email);
  if (!pending || pending.expiresAt < Date.now()) {
    res.status(400).json({ error: "Challenge expiré" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) { res.status(401).json({ error: "Utilisateur introuvable" }); return; }

  const [cred] = await db.select().from(webauthnCredentialsTable).where(
    and(eq(webauthnCredentialsTable.userId, user.id), eq(webauthnCredentialsTable.credentialId, authResponse.id))
  );
  if (!cred) { res.status(401).json({ error: "Identifiant introuvable" }); return; }

  try {
    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: pending.challenge,
      expectedOrigin: getOrigin(req as AuthenticatedRequest),
      expectedRPID: getRpId(req as AuthenticatedRequest),
      credential: {
        id: cred.credentialId,
        publicKey: fromBase64url(cred.publicKey) as Uint8Array<ArrayBuffer>,
        counter: cred.counter,
        transports: ["internal"],
      },
      requireUserVerification: true,
    });

    if (!verification.verified) { res.status(401).json({ error: "Authentification échouée" }); return; }

    await db.update(webauthnCredentialsTable)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(webauthnCredentialsTable.id, cred.id));
    loginChallenges.delete(email);

    const token = generateToken(user.id);
    res.json({
      user: {
        id: user.id, email: user.email, companyName: user.companyName,
        ifu: user.ifu, role: user.role, phone: user.phone, country: user.country,
      },
      token,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentification échouée";
    res.status(401).json({ error: msg });
  }
});

router.delete("/auth/webauthn/credentials", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await db.delete(webauthnCredentialsTable).where(eq(webauthnCredentialsTable.userId, req.userId!));
  res.json({ success: true });
});

export default router;
