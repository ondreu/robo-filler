FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/src ./src
COPY server/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
# Výchozí data — při prvním startu se naseedují do DATA_DIR (viz entrypoint.sh).
# Editace přes admin se ukládají do DATA_DIR (perzistentní volume) a přežijí update.
COPY public/master-data.csv public/master-data-effi.csv public/wires.json public/cables.json public/kanban.json /app/seed/
ENV DATA_DIR=/app/data
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "src/index.js"]
