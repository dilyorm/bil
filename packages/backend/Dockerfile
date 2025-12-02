# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/backend/src ./packages/backend/src
COPY packages/shared/src ./packages/shared/src
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY tsconfig.json ./

# Build the application
RUN npm run build --workspace=packages/backend

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bil -u 1001

# Set working directory
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=bil:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=bil:nodejs /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder --chown=bil:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=bil:nodejs /app/packages/backend/package.json ./packages/backend/

# Switch to non-root user
USER bil

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/backend/dist/index.js"]