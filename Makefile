DOCKER_IMAGE = oam/server-api:latest

all: api

api:
	@docker build -f ./Dockerfile -t $(DOCKER_IMAGE) .

start: api
	@docker run \
		--rm \
		--name oam-server-api \
		--env-file .env \
		--publish 8000:8000 \
		--volume $(PWD)/api:/app/api \
		$(DOCKER_IMAGE)

test: api
	# run the server in the background
	@make start &
	@sleep 1

	@docker run \
		--rm \
		--name oam-server-api-test \
		--link oam-server-api:oam-server-api \
		--volume $(PWD)/api:/app/api \
		--entrypoint /usr/local/bin/npm \
		$(DOCKER_IMAGE) test

	@docker kill oam-server-api > /dev/null

.PHONY: all api start test
