FROM node:4.2-slim

MAINTAINER Humanitarian OpenStreetMap Team

ENV HOME /app
ENV PORT 8000
ENV npm_config_loglevel warn

RUN apt-get update && \
  apt-get install -y python-pip && \
  apt-get clean && \
  pip install awscli

RUN useradd \
  --create-home \
  --home-dir /app \
  --user-group \
  oam

USER oam
WORKDIR /app

COPY ./api/package.json /app/

RUN npm install

COPY api/ /app

CMD npm start
