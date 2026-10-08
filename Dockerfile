FROM node:20-alpine

WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy package definitions
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Ensure data directory exists
RUN mkdir -p /data

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV DATA_DIR=/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/settings || exit 1

CMD ["node", "server.js"]
