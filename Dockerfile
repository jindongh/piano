FROM node:22-bookworm-slim

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package.json package-lock.json ./
RUN npm install

# Copy application source
COPY . .

# Build application
ENV NODE_ENV=production
RUN npm run build

# Ensure persistent data directory exists
RUN mkdir -p /app/data
ENV DATA_DIR=/app/data

# Expose server port
EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["npm", "run", "preview"]
