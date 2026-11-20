# Đảo Đèn Lồng v1.0.0 — chạy server game trong Docker:
#   docker build -t dao-den-long . && docker run --rm -p 8080:8080 -v ddl-data:/app/data dao-den-long
# (bench cần trình duyệt có GPU nên chạy ngoài Docker; test/headless/soak chạy được trong image.)
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/server.js"]
