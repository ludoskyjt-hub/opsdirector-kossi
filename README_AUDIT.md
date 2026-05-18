# README_AUDIT.md
# ENAM Impact Agency — Package d'Audit Architectural Complet
## Document confidentiel — Usage exclusif pour l'audit technique externe

---

## 1. VUE D'ENSEMBLE DE L'ARCHITECTURE

### Modèle : Monolithe Modulaire + Frontends Séparés

```
BLOC B2B (Infrastructure commune, DB partagée, SSO unifié)
├── API Centrale              → https://api.enamimpactagency.com
├── BéninExpense AI           → https://app.enamimpactagency.com
├── OpsDirector (KOSSI)       → https://ops.enamimpactagency.com
└── Boutiko (HOUÉFA)          → https://boutiko.enamimpactagency.com

BLOC B2C (Totalement isolé du B2B)
└── MelodiaPerTe (MELODIA)    → https://melodiaperte.enamimpactagency.com

PORTAIL PRINCIPAL
└── ENAM Impact Agency Portal → https://enamimpactagency.com
```

---

## 2. STACK TECHNOLOGIQUE

### Backend (API Centrale)
| Composant | Technologie | Version |
|-----------|-------------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | Express | 5.x |
| Langage | TypeScript | 5.9 |
| ORM | Drizzle ORM | 0.45 |
| Base de données | PostgreSQL | 16 |
| Validation | Zod (v4) | 3.25 |
| Auth | JWT HMAC-SHA256 + bcrypt | Custom |
| Logger | Pino | 9.x |
| Build | esbuild | 0.27 |
| Tests | Vitest | Latest |
| Monorepo | pnpm workspaces | 9.x |

### Frontends
| Application | Framework | Agent IA | Déploiement |
|-------------|-----------|----------|-------------|
| BéninExpense AI | React 19 + Vite 7 | AFIWA | Vercel |
| OpsDirector | React 19 + Vite 7 | KOSSI | Vercel |
| Boutiko | React 19 + Vite 7 | HOUÉFA | Vercel |
| MelodiaPerTe | React 19 + Vite 7 | MELODIA | Vercel |
| ENAM Portal | React 19 + Vite 7 | — | Vercel |
| App Mobile | React Native (Expo) | HOUÉFA | Expo EAS |

### Bibliothèques communes (toutes apps)
- TailwindCSS 4.x + shadcn/ui
- TanStack React Query 5.x (offline-first)
- Wouter 3.x (routing)
- Lucide React (icônes)
- TypeScript 5.9

### Infrastructure
| Service | Provider | Usage |
|---------|----------|-------|
| API + DB | Railway | Backend Node.js + PostgreSQL |
| Frontends | Vercel | 5 apps React statiques |
| DNS | Namecheap | enamimpactagency.com |
| AI | OpenAI (GPT-4o-mini) | AFIWA, HOUÉFA, KOSSI, MELODIA |

---

## 3. STRUCTURE DE LA BASE DE DONNÉES

### Bloc B2B — Tables principales
```
users                    → Comptes entreprises (BéninExpense, SSO B2B)
expenses                 → Dépenses avec statut DGI e-MECeF
accounts                 → Comptes bancaires (Caisse, Banque, MoMo)
employees                → Gestion des employés
employee_limits          → Plafonds de dépenses par employé
categories               → Catégories de dépenses
budgets                  → Budgets mensuels
fraud_rules              → Règles AFIWA Sentinelle (détection fraude)
audit_logs               → Journal d'audit complet
recurring_expenses       → Dépenses récurrentes
momo_transactions        → Transactions Mobile Money
push_tokens              → Tokens notifications push
webauthn_credentials     → Authentification biométrique
```

### Bloc Boutiko
```
boutiko_users            → Comptes gérants de boutiques
boutiko_boutiques        → Profils de boutiques
boutiko_products         → Inventaire produits
boutiko_clients          → Portefeuille clients
boutiko_sales            → Ventes (POS)
boutiko_sale_items       → Détails lignes de vente
```

### Bloc OpsDirector (KOSSI)
```
ops_users                → Comptes dirigeants
ops_conversations        → Historique conversations KOSSI
ops_messages             → Messages dans conversations
ops_projects             → Projets stratégiques
ops_ideas                → Idées et innovations
ops_tasks                → Tâches opérationnelles
ops_reminders            → Rappels et alertes
ops_memory               → Mémoire persistante KOSSI
ops_webauthn             → Auth biométrique OpsDirector
```

### Champs DGI e-MECeF (table expenses)
```sql
dgi_status        ENUM(not_submitted, submitted, validated, rejected)
dgi_qr_code       TEXT  -- QR code MECeF officiel
dgi_reference     TEXT  -- Référence MECeF normalisée
risk_level        ENUM(none, low, medium, high)  -- AFIWA Sentinelle
flag_reason       TEXT  -- Raison du flag AFIWA
```

---

## 4. AGENTS IA

### AFIWA — BéninExpense (Expert DGI)
- **Route** : `POST /api/ai/chat`
- **Fonctions** : Saisie voix/texte→dépense, scan reçu (Vision), Sentinelle fraude, conformité DGI, web_search
- **Modèle** : GPT-4o-mini + fallback local (NLP)

### HOUÉFA — Boutiko (Commerce)
- **Route** : `POST /api/boutiko/ai/chat`
- **Fonctions** : Analyse stock dormant, top clients, résumé ventes, recommandations promos
- **Modèle** : GPT-4o-mini + web_search (taux de change, etc.)

### KOSSI — OpsDirector (Direction)
- **Route** : tRPC `conversations.sendMessage`
- **Fonctions** : Gestion projets, mémoire persistante, lecture documents (PDF/Excel), web_search, transcription vocale
- **Modèle** : GPT-5.4 (via AI_INTEGRATIONS endpoint)

### MELODIA — MelodiaPerTe (Musique)
- **Route** : `POST /api/melodia/chat`
- **Fonctions** : Recommandations musicales africaines, info artistes, genres (Afrobeats, Coupé-Décalé, Zoblazo), web_search
- **Modèle** : GPT-4o-mini + fallback local

---

## 5. INSTALLATION EN LOCAL

### Prérequis
- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Git

### Installation
```bash
# 1. Cloner le dépôt
git clone https://github.com/ludoskyjt-hub/enam-impact-agency.git
cd enam-impact-agency

# 2. Installer les dépendances (workspace)
pnpm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Pousser le schéma de base de données
pnpm --filter @workspace/db run push

# 5. Lancer l'API
pnpm --filter @workspace/api-server run dev

# 6. Lancer un frontend (exemple BéninExpense)
pnpm --filter @workspace/dashboard run dev

# 7. Lancer les tests
cd artifacts/api-server && pnpm test
```

---

## 6. VARIABLES D'ENVIRONNEMENT REQUISES

### API Server (Railway) — OBLIGATOIRES
```env
# Base de données
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Sécurité JWT (min 32 caractères, aléatoire)
JWT_SECRET=votre_secret_jwt_minimum_32_caracteres

# Intelligence Artificielle (OpenAI)
OPENAI_API_KEY=sk-proj-...
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# CORS — Domaines autorisés
CORS_ORIGINS=https://enamimpactagency.com,https://app.enamimpactagency.com,https://boutiko.enamimpactagency.com,https://ops.enamimpactagency.com,https://melodiaperte.enamimpactagency.com

# Environnement
NODE_ENV=production
```

### Variables optionnelles (futures intégrations)
```env
# DGI Bénin e-MECeF (API de normalisation fiscale)
DGI_API_URL=https://api.dgi.bj/mecef
DGI_API_KEY=                           # Clé API DGI (à obtenir)
DGI_CLIENT_ID=                         # Identifiant client DGI

# Notifications Push (Web Push VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:contact@enamimpactagency.com

# Email (notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@enamimpactagency.com
SMTP_PASS=

# Mobile Money (futures intégrations)
MTN_MOMO_API_KEY=                      # MTN Mobile Money Bénin
MOOV_API_KEY=                          # Moov Money Bénin
```

### Frontends Vercel
```env
BASE_PATH=/
```

---

## 7. DÉPLOIEMENT PRODUCTION

### Architecture de déploiement
```
GitHub (ludoskyjt-hub/enam-impact-agency)
    ↓ auto-deploy on push to main
Railway → API + PostgreSQL (function-bun service)
Vercel  → 5 frontends statiques (benin-expense, boutiko-final, ops-director-final, enam-portal-final, melodia-final)
```

### Commandes de déploiement
```bash
# Build API (Dockerfile)
docker build -t enam-api .
docker run -p 8080:8080 --env-file .env enam-api

# Build frontend (exemple BéninExpense)
pnpm --filter @workspace/dashboard exec vite build
# → artifacts/dashboard/dist/public/

# Pousser le schéma DB (migrations)
pnpm --filter @workspace/db run push
```

---

## 8. SÉCURITÉ — CONFORMITÉ AUDIT

### Points vérifiés ✅
- ✅ **Zéro secret hardcodé** — Toutes les clés via `process.env`
- ✅ **JWT signé HMAC-SHA256** — Remplace les tokens userId:timestamp forgeables
- ✅ **bcrypt** — Mots de passe hashés avec 12 rounds
- ✅ **Validation Zod** — Toutes les entrées API validées
- ✅ **CORS configuré** — Domaines whitelist uniquement
- ✅ **Headers sécurité** — X-Content-Type-Options, X-Frame-Options, etc.
- ✅ **Rate limiting** — 300 req/min global, 15 req/min sur /auth
- ✅ **Audit logs** — Toutes les actions sensibles tracées
- ✅ **Offline-first** — Service Workers, React Query offline mode

### Points d'attention pour l'audit
- 🔄 **DGI e-MECeF** — Actuellement simulé (API DGI sandbox). La clé production est à obtenir auprès de la DGI Bénin.
- 🔄 **Mobile Money** — Intégration MTN/Moov en sandbox. Clés production à configurer.
- ℹ️  **OpsDirector WebAuthn** — Authentification biométrique disponible mais optionnelle.

---

## 9. MODULES INCLUS DANS CE PACKAGE

| Module | Bloc | Statut | Agent IA |
|--------|------|--------|----------|
| BéninExpense AI | B2B | ✅ Production | AFIWA |
| OpsDirector | B2B | ✅ Production | KOSSI |
| Boutiko | B2B | ✅ Production | HOUÉFA |
| MelodiaPerTe | B2C (isolé) | ✅ Production | MELODIA |
| ENAM Portal | Landing | ✅ Production | — |
| App Mobile (Boutiko) | B2B | ✅ Expo | HOUÉFA |
| API Centrale | Infrastructure | ✅ Railway | — |
| Base de données | Infrastructure | ✅ PostgreSQL | — |

---

## 10. CONTACTS & REPOSITORY

- **Organisation** : ENAM Impact Agency SARL, Cotonou, Bénin
- **Fondateur** : Julien TOMEGAH
- **Repository GitHub** : https://github.com/ludoskyjt-hub/enam-impact-agency
- **API en production** : https://function-bun-production-8308.up.railway.app
- **Portal** : https://enamimpactagency.com

---

*Document généré automatiquement pour audit — Confidentiel*
