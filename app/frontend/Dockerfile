FROM node:24-bookworm-slim

RUN npm install --global pnpm@11.25.0

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173
CMD ["pnpm", "dev"]
