FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies first (leveraging layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source
COPY . .

# Build application
ENV NODE_ENV=production
RUN npm run build

# Expose server port
EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["npm", "run", "preview"]
