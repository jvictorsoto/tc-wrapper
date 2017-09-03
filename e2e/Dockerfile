FROM mhart/alpine-node:8

RUN apk --no-cache add iproute2

RUN mkdir -p /app
WORKDIR /app

COPY package.json package.json
RUN npm i

COPY . .

RUN npm run -s build > /dev/null
