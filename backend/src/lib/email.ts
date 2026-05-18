import { logger } from "./logger";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.info({ to: payload.to, subject: payload.subject }, "Email skipped (no RESEND_API_KEY)");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BéninExpense AI <noreply@beninexpense.bj>",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      logger.warn({ err }, "Email send failed");
    }
  } catch (err) {
    logger.warn({ err }, "Email send error");
  }
}

export function buildExpenseValidatedEmail(opts: {
  companyName: string;
  description: string;
  amount: number;
  status: "validated" | "rejected";
  rejectionReason?: string;
}): string {
  const statusLabel = opts.status === "validated" ? "✅ Validée" : "❌ Rejetée";
  const statusColor = opts.status === "validated" ? "#0F5132" : "#DC2626";
  const amount = new Intl.NumberFormat("fr-FR").format(opts.amount);
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>BéninExpense AI</title></head>
<body style="font-family:sans-serif;background:#f4f4f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#0f1a2e;padding:28px 32px">
      <span style="color:#f5c842;font-size:20px;font-weight:700">BéninExpense AI</span>
      <p style="color:#ffffff99;margin:4px 0 0;font-size:13px">Notification de dépense</p>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:16px;font-weight:600;margin:0 0 16px">Dépense <span style="color:${statusColor}">${statusLabel}</span></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#666;width:40%">Entreprise</td><td style="padding:8px 0;font-weight:600">${opts.companyName}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Description</td><td style="padding:8px 0">${opts.description}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Montant</td><td style="padding:8px 0;font-weight:700;font-size:16px">${amount} FCFA</td></tr>
        ${opts.rejectionReason ? `<tr><td style="padding:8px 0;color:#666">Motif de rejet</td><td style="padding:8px 0;color:#DC2626">${opts.rejectionReason}</td></tr>` : ""}
      </table>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;font-size:11px;color:#999;border-top:1px solid #e5e7eb">
      BéninExpense AI · Gestion des dépenses &amp; conformité fiscale DGI e-MECeF
    </div>
  </div>
</body>
</html>`;
}

export function buildBudgetAlertEmail(opts: {
  companyName: string;
  category: string;
  spent: number;
  limit: number;
  percent: number;
}): string {
  const spent = new Intl.NumberFormat("fr-FR").format(opts.spent);
  const limit = new Intl.NumberFormat("fr-FR").format(opts.limit);
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>BéninExpense AI</title></head>
<body style="font-family:sans-serif;background:#f4f4f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#0f1a2e;padding:28px 32px">
      <span style="color:#f5c842;font-size:20px;font-weight:700">BéninExpense AI</span>
      <p style="color:#ffffff99;margin:4px 0 0;font-size:13px">Alerte budget</p>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:16px;font-weight:600;margin:0 0 8px">⚠️ Alerte dépassement de budget</p>
      <p style="color:#666;font-size:14px;margin:0 0 16px">Le budget <strong>${opts.category}</strong> a atteint <strong style="color:#DC2626">${opts.percent}%</strong> de sa limite.</p>
      <div style="background:#FEF2F2;border:1px solid #FEE2E2;border-radius:8px;padding:16px">
        <p style="margin:0;font-size:14px">Dépensé : <strong>${spent} FCFA</strong> / Limite : <strong>${limit} FCFA</strong></p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;font-size:11px;color:#999;border-top:1px solid #e5e7eb">
      BéninExpense AI · ${opts.companyName}
    </div>
  </div>
</body>
</html>`;
}

export function buildMonthlyReportEmail(opts: {
  companyName: string;
  month: string;
  totalExpenses: number;
  expenseCount: number;
  topCategory: string;
}): string {
  const total = new Intl.NumberFormat("fr-FR").format(opts.totalExpenses);
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>BéninExpense AI</title></head>
<body style="font-family:sans-serif;background:#f4f4f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#0f1a2e;padding:28px 32px">
      <span style="color:#f5c842;font-size:20px;font-weight:700">BéninExpense AI</span>
      <p style="color:#ffffff99;margin:4px 0 0;font-size:13px">Rapport mensuel — ${opts.month}</p>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:16px;font-weight:600;margin:0 0 16px">📊 Synthèse du mois</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#666;width:50%">Total dépensé</td><td style="padding:8px 0;font-weight:700;font-size:18px;color:#0F5132">${total} FCFA</td></tr>
        <tr><td style="padding:8px 0;color:#666">Nombre de dépenses</td><td style="padding:8px 0;font-weight:600">${opts.expenseCount}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Catégorie principale</td><td style="padding:8px 0">${opts.topCategory}</td></tr>
      </table>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;font-size:11px;color:#999;border-top:1px solid #e5e7eb">
      BéninExpense AI · ${opts.companyName} · Connectez-vous pour télécharger le rapport PDF complet.
    </div>
  </div>
</body>
</html>`;
}
