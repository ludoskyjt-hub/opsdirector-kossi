import type { Express, Request, Response } from "express";
import {
  generateAuthenticationOptions, generateRegistrationOptions,
  verifyAuthenticationResponse, verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { db } from "@workspace/db";
import { opsWebauthnCredentialsTable, opsUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const challenges = new Map<string, string>();
const RP_NAME = "OpsDirector";
const RP_ID = process.env.REPLIT_DEV_DOMAIN?.split(",")[0]?.split(":")[0] ?? "localhost";
const ORIGIN = process.env.NODE_ENV === "production"
  ? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`
  : `https://${RP_ID}`;

function makeToken(userId: number): string {
  return `${userId}:${Date.now()}`;
}

export function registerOpsWebAuthnRoutes(app: Express) {
  // ── Registration ──────────────────────────────────────────────────────────

  app.post("/api/ops/webauthn/register/options", async (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: number };
    if (!userId) { res.status(400).json({ error: "userId requis" }); return; }

    const users = await db.select().from(opsUsersTable).where(eq(opsUsersTable.id, userId)).limit(1);
    if (!users[0]) { res.status(404).json({ error: "Utilisateur non trouvé" }); return; }
    const user = users[0];

    const existingCreds = await db.select().from(opsWebauthnCredentialsTable).where(eq(opsWebauthnCredentialsTable.userId, userId));
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID,
      userID: new TextEncoder().encode(String(user.id)),
      userName: user.email,
      userDisplayName: user.name ?? user.email,
      excludeCredentials: existingCreds.map((c) => ({ id: c.credentialId, type: "public-key" as const })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    challenges.set(String(userId), options.challenge);
    res.json(options);
  });

  app.post("/api/ops/webauthn/register/verify", async (req: Request, res: Response) => {
    const { userId, credential } = req.body as { userId?: number; credential?: unknown };
    if (!userId || !credential) { res.status(400).json({ error: "Données manquantes" }); return; }

    const expectedChallenge = challenges.get(String(userId));
    if (!expectedChallenge) { res.status(400).json({ error: "Challenge expiré" }); return; }

    try {
      const verification = await verifyRegistrationResponse({
        response: credential as any,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      });
      if (!verification.verified || !verification.registrationInfo) {
        res.json({ verified: false }); return;
      }
      const { credential: cred } = verification.registrationInfo;
      await db.insert(opsWebauthnCredentialsTable).values({
        userId, credentialId: cred.id,
        publicKey: Buffer.from(cred.publicKey).toString("base64"),
        counter: cred.counter,
        deviceType: verification.registrationInfo.credentialDeviceType ?? null,
      });
      challenges.delete(String(userId));
      res.json({ verified: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Authentication ────────────────────────────────────────────────────────

  app.post("/api/ops/webauthn/authenticate/options", async (_req: Request, res: Response) => {
    const allCreds = await db.select().from(opsWebauthnCredentialsTable);
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: allCreds.map((c) => ({ id: c.credentialId, type: "public-key" as const })),
      userVerification: "preferred",
    });
    challenges.set("auth", options.challenge);
    res.json(options);
  });

  app.post("/api/ops/webauthn/authenticate/verify", async (req: Request, res: Response) => {
    const expectedChallenge = challenges.get("auth");
    if (!expectedChallenge) { res.status(400).json({ error: "Challenge expiré" }); return; }

    try {
      const credential = req.body as any;
      const creds = await db.select().from(opsWebauthnCredentialsTable).where(eq(opsWebauthnCredentialsTable.credentialId, credential.id)).limit(1);
      if (!creds[0]) { res.status(404).json({ error: "Credential non trouvé" }); return; }
      const storedCred = creds[0];

      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
        credential: {
          id: storedCred.credentialId,
          publicKey: new Uint8Array(Buffer.from(storedCred.publicKey, "base64")),
          counter: storedCred.counter,
        },
      });
      if (!verification.verified) { res.json({ error: "Vérification échouée" }); return; }
      await db.update(opsWebauthnCredentialsTable).set({ counter: verification.authenticationInfo.newCounter }).where(eq(opsWebauthnCredentialsTable.id, storedCred.id));
      challenges.delete("auth");
      const token = makeToken(storedCred.userId);
      res.json({ token });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
}
