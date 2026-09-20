FROM node:24-alpine
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web ./
ENV NEXT_TELEMETRY_DISABLED=1
ARG TAIJI_API_URL=http://api:8000
ENV TAIJI_API_URL=${TAIJI_API_URL}
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
