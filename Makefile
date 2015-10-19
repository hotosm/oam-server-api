DOCKER_IMAGE = oam/server-api:latest

all: api

api:
	@docker build -f ./Dockerfile -t $(DOCKER_IMAGE) .

start: api
	@docker run \
		--detach \
		--rm \
		--name oam-server-api \
		--publish 8000:8000 \
		--volume $(PWD)/api:/app/api \
		$(DOCKER_IMAGE) start

test: start
	@sleep 1

	@docker run \
		--rm \
		--name oam-server-api-test \
		--link oam-server-api:oam-server-api \
		--volume $(PWD)/api:/app/api \
		$(DOCKER_IMAGE) test

	@docker kill oam-server-api > /dev/null
	@docker rm oam-server-api > /dev/null

clean:
	@docker kill oam-server-api > /dev/null 2>&1 || true
	@docker rm oam-server-api > /dev/null 2>&1 || true


.PHONY: all api start test clean
