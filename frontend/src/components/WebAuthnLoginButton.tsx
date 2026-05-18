import { useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setOpsToken } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

const BASE = "/api/ops";

export default function WebAuthnLoginButton() {
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

  const handleWebAuthn = async () => {
    setLoading(true);
    try {
      const authOpts = await fetch(`${BASE}/webauthn/authenticate/options`, { method: "POST" }).then((r) => r.json());
      if (authOpts.error) { toast.error(authOpts.error); return; }
      const assertion = await startAuthentication({ optionsJSON: authOpts });
      const result = await fetch(`${BASE}/webauthn/authenticate/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      }).then((r) => r.json());
      if (!result.token) { toast.error(result.error || "Échec Face ID"); return; }
      setOpsToken(result.token);
      await utils.auth.me.invalidate();
      window.location.reload();
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") toast.error("Face ID non disponible sur cet appareil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" onClick={handleWebAuthn} disabled={loading}
      className="w-full gap-2 text-sm"
      style={{ background: "oklch(0.14 0.006 270)", border: "1px solid var(--border)", color: "oklch(0.75 0.008 60)" }}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
      Connexion via Face ID / Empreinte
    </Button>
  );
}
