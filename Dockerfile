FROM node:0.10-slim

MAINTAINER Humanitarian OpenStreetMap Team

ENV HOME /app
ENV PORT 8000

RUN mkdir -p /app/api
WORKDIR /app

COPY ./api/package.json /app/

RUN npm install

RUN useradd \
  --home-dir /app/api \
  --system \
  --user-group \
  oam \
  && chown -R oam:oam /app

USER oam
WORKDIR /app/api

COPY . /app/api

ENTRYPOINT ["npm"]
