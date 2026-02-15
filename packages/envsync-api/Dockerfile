FROM oven/bun:1.2.15

WORKDIR /app

COPY package.json ./

RUN bun install

COPY . .

RUN bun run build

CMD [ "bun", "start" ]