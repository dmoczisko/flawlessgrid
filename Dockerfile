FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY public/ ./public/
COPY index.html vite.config.ts tsconfig*.json env.d.ts ./
COPY eslint.config.ts vitest.config.ts cypress.config.ts ./
# Set the API base URL for production build
ENV VITE_API_BASE_URL=""
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY api-service/package*.json ./
RUN npm ci
COPY api-service/ ./
# Copy shared types from frontend
COPY src/types/ ./src/types/

# Production stage
FROM node:20-alpine
WORKDIR /

# Copy shared types to the correct relative path for the backend
COPY --from=frontend-build /app/src/types/ ./src/types/

# Set working directory and copy backend
WORKDIR /app
COPY --from=backend-build /app ./

# Copy built frontend
COPY --from=frontend-build /app/dist ./public

# Install ts-node globally to run TypeScript
RUN npm install -g ts-node

EXPOSE 3001
CMD ["ts-node", "server.ts"]