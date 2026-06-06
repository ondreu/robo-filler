FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/src ./src
COPY public/master-data.csv ./data/master-data.csv
COPY public/master-data-effi.csv ./data/master-data-effi.csv
ENV DATA_DIR=/app/data
CMD ["node", "src/index.js"]
