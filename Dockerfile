FROM node:20-alpine

# Installer pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copier TOUT le code (nécessaire pour le workspace pnpm)
COPY . .

# Installer TOUTES les dépendances (production uniquement pour légèreté)
RUN pnpm install --no-frozen-lockfile

# Builder uniquement l'api-server
RUN pnpm --filter @workspace/api-server run build

# Nettoyer les devDependencies pour réduire la taille
RUN pnpm prune --prod

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
