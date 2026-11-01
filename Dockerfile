# stdio build of Rast Creator Tools (same tools as the hosted endpoint).
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npx esbuild src/stdio.ts --bundle --platform=node --format=esm --target=node20 --outfile=dist/stdio.mjs
CMD ["node", "dist/stdio.mjs"]
