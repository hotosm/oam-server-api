# OpenAerialMap Server: API component

[![Circle CI](https://circleci.com/gh/hotosm/oam-server-api/tree/master.svg?style=svg)](https://circleci.com/gh/hotosm/oam-server-api/tree/master)
[![Docker Repository on Quay.io](https://quay.io/repository/hotosm/oam-server-api/status "Docker Repository on Quay.io")](https://quay.io/repository/hotosm/oam-server-api)

The API component of OAM Server is a node `express` server that exposes API
endpoints. A list of the endpoints exposed, and their functionality, is found
below

## ENDPOINTS

#### /tile

This takes a tiling request `POST`ed, and a auth token in a query string, and
kicks off a tiling job.

Here's an example request JSON:

```javascript
{
  "sources" : [
    "http://hotosm-oam.s3.amazonaws.com/356f564e3a0dc9d15553c17cf4583f21-0.tif",
    "http://oin-astrodigital.s3.amazonaws.com/LC81420412015111LGN00_bands_432.TIF"
  ]
}
```

As you can see, all the request has is the source images in a `sources`
property.

You'll need to provide a valid token to the request in a query string, for
example:

```
curl -X POST -d @test-req.json http://localhost:8000/tile?token=5a77ef22-4328-4d11-8f64-2ce90dff275a --header "Content-Type:application/json"
```

A response from a valid tile submission looks like:

```javascript
{"id":"feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391"}
```

The `id` is the job ID, which is important to keep track of, because that is
how you will be able to check the status of the job.

#### /status

This takes a job `id` and gives a status. If the job is complete, the
`tileJson` property will give the TileJSON result of the tiling job.

The request takes the job id in the path:
```
curl http://localhost:8000/status/feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391
```

And will return one of the following:
```javascript
{"status":"PENDING","id":"feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391"}
{"status":"STARTED","stage":"chunk","id":"feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391"}
{"status":"FINISHED","stage":"chunk","id":"feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391"}
{"status":"FAILED","stage":"chunk","error":"An error message.","id":"feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391"}
{"status":"STARTED","stage":"mosaic","id":"feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391"}
{"status":"FAILED","stage":"mosaic","error":"An error message.","id":"feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391"}
{"status":"COMPLETE","id":"feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391","tileJson": {...} }
```

The TileJSON of a completed job will look like this:
```javascript
{
    "tilejson": "2.1.0",
    "name": "OAM Server Mosaic feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391",
    "attribution": "<a href='http://github.com/openimagerynetwork/'>OIN contributors</a>",
    "scheme": "xyz",
    "tiles": [
        "http://oam-tiles.s3.amazonaws.com/001199d2-381a-4498-86de-e7f11da0a191/{z}/{x}/{y}.png"
    ]
}
```

#### /info

Given a job `id`, this gives information about the request. For instance,

```
curl http://localhost:8000/info/feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391
```

might yield
```javascript
{
    "id": "feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391",
    "images": [
        "http://hotosm-oam.s3.amazonaws.com/356f564e3a0dc9d15553c17cf4583f21-0.tif",
        "http://oin-astrodigital.s3.amazonaws.com/LC81420412015111LGN00_bands_432.TIF"
    ],
    "request_time": "2015-09-24T03:16:54.196Z"
}
```

#### /requests

This will list all the requests that are still on the APi's radar (tiling
requests and statuses get cleared after a number of days).

```
curl http://localhost:8000/requests
```

```javascript
[
    {
        "jobId": "24bae674-329b-4a54-802b-c87ca3357267",
        "request_time": "2015-09-24T03:15:11.000Z"
    },
    {
        "jobId": "d01c4418-66c5-445f-971e-1430ffa4102e",
        "request_time": "2015-09-24T03:15:35.000Z"
    },
    {
        "jobId": "feb310ad-b2eb-4ec6-8f23-dcdaf9bc6391",
        "request_time": "2015-09-24T03:16:55.000Z"
    }
]
```

## Usage

The main avenue for developing against the OpenAerialMap (OAM) server is via
Docker. To get started, ensure that you have a [working Docker
environment](https://docs.docker.com/machine/), with version `>=1.7`. In
addition, all interactions with Docker and NPM are wrapped within a `Makefile`.

In order to build this image, use the `api` target:

```bash
$ make api
Sending build context to Docker daemon  7.68 kB
Sending build context to Docker daemon

...

Successfully built e2666914b094
```

From there, you can start the server using the `start` target:

```bash
$ make start
b1d7b15d68632883ba81c6098719036caf3c4e23dff964666a42d736bee96a33
$ docker ps
CONTAINER ID        IMAGE                   COMMAND             CREATED             STATUS              PORTS                    NAMES
b1d7b15d6863        oam/server-api:latest   "npm start"         19 seconds ago      Up 16 seconds       0.0.0.0:8000->8000/tcp   oam-server-api
```

### Environment Variables

* `AWS_ACCESS_KEY_ID` - AWS access key id. Required unless an IAM role is in
  use.
* `AWS_SECRET_ACCESS_KEY` - AWS secret access key. Required unless an IAM role
* `AWS_DEFAULT_REGION` - AWS region. Required.
  is in use.
* `OAM_SMALL_CLUSTER_SIZE` - Number of EMR nodes to use for a "small" job.
  Required.
* `OAM_MED_CLUSTER_SIZE` - Number of EMR nodes to use for a "medium" job.
  Required.
* `OAM_LARGE_CLUSTER_SIZE` - Number of EMR nodes to use for a "large" job.
  Required.
* `OAM_SMALL_IMAGE_COUNT` - Upper bound on the number of images for a "large"
  job. Required.
* `OAM_MED_IMAGE_COUNT` - Upper bound on the number of images for a "medium"
  job.  Required.
* `OAM_KEYNAME` - SSH key name (for interacting with an EMR cluster). Required.
* `OAM_MASTER_INSTANCE_TYPE` - EC2 instance type to use for master nodes. Required.
* `OAM_WORKER_INSTANCE_TYPE` - EC2 instance type to use for task nodes. Required.
* `OAM_WORKER_INSTANCE_BIDPRICE` - Target EC2 spot price for task nodes. Required.
* `OAM_STATUS_BUCKET` - S3 bucket containing task status. Required.
* `OAM_STATUS_PREFIX` - Path prefix for task statuses. Required.
* `OAM_TILER_TOKEN_BUCKET` - S3 bucket containing OAM Catalog keys. Required.
* `OAM_TILER_TOKEN_KEY` - Filename (in above bucket) containing keys. Required.
* `OAM_EMR_CLUSTER_ID` - EMR cluster id. Optional.
* `OAM_EMR_CLUSTER_SIZE` - Explicity cluster size (spot instances). Optional.
* `DEBUG` - Debug logging configuration. Set to `oam:*` for all messages.
  Optional.

## Testing

To execute the test suite, use the `test` target:

```bash
$ make test
7d10c9d66f7b33d0f2b6b16fe2fc94df41440cb395ab24e8be91d3b397257fe4

> oam-server@0.1.0 test /app
> node test.js

Checking http://oam-server-api:8000/tile
200 {"test":"test"}
```

**Note**: For the `start` and `test` targets, contents within the `api`
directory gets mounted inside of the container via a volume to ensure that the
latest code changes are being tested.
