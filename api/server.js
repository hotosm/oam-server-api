"use strict";

var assert = require("assert"),
    util = require("util");

var bodyParser = require("body-parser"),
    chance = require("chance"),
    express = require("express"),
    morgan = require("morgan"),
    uuid = require("uuid");

var auth = require("./lib/auth"),
    statusStore = require("./lib/status-store"),
    tiler = require("./lib/tiler");

var app = express().disable("x-powered-by");

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use(bodyParser.json());

app.get("/", function(req, res) {
  res.send("pong");
});

/**
 * Given a list of images, return a UUID that can be used to track the progress
 * of a tiling request.
 */
app.post("/tile", function(req, res, next) {
  try {
    assert.ok(req.query.token, "'token' query parameter is needed to kick off tiling jobs.");
    assert.equal("application/json", req.headers["content-type"], "Payload's Content-Type must be 'application/json'");
    assert.ok(Array.isArray(req.body.sources), "sources must be a list of images.");

    req.body.sources.forEach(function(src) {
      // sources may either be a list of strings or a list of objects
      if (typeof src !== "string") {
        // if a list of objects, uri is the only required field (other OIN
        // metadata is welcomed and may be used to adjust tiling job
        // properties)
        assert.ok(src.uri, "source 'uri' is required.");
      }
    });
  } catch (err) {
    return next(err);
  }

  return auth.fetchTokens(function(err, tokens) {
    if (err) {
      return next(err);
    }

    if (tokens.indexOf(req.query.token) < 0) {
      return res.status(403).json({
        error: "INVALID TOKEN",
        message: "The token parameter is invalid. Please contact an administrator for a valid token."
      });
    }

    var jobId = uuid.v4();

    return tiler.launchJob(jobId, req.body.sources, function(err) {
      if (err) {
        return next(err);
      }

      return statusStore.create(jobId, function(err) {
        if (err) {
          return next(err);
        }

        return res.status(202).json({
          id: jobId
        });
      });
    });
  });
});

/**
 * Get info about a tiling request.
 */
app.get("/info/:uuid", function(req, res, next) {
  return tiler.fetchRequest(req.params.uuid, function(err, tileRequest) {
    if (err) {
      return res.status(404).json({
        error: "NotFound",
        message: util.format("'%s' not found.", req.params.uuid)
      });
    }

    return res.json({
      id: tileRequest.jobId,
      images: tileRequest.images,
      request_time: tileRequest.request_time
    });
  });
});

/**
 * Get the status of a tiling request.
 */
app.get("/status/:uuid", function(req, res, next) {
  // predictable responses for debugging
  return statusStore.retrieve(req.params.uuid, function(err, status) {
    if (err) {
      return res.status(404).json({
        error: "NotFound",
        message: util.format("'%s' not found.", req.params.uuid)
      });
    }

    if (!status.status) {
      return res.status(500).json({
        error: "Invalid Status",
        message: util.format("Invalid status found: '%j'.", status)
      });
    }

    switch (status.status) {
    case "PENDING":
      return res.json({
        status: "PENDING",
        id: req.params.uuid
      });

    case "STARTED":
    case "FINISHED":
      return res.json({
        status: "PROCESSING",
        id: req.params.uuid,
        message: status.stage
      });

    case "SUCCESS":
      return res.json({
        status: "COMPLETED",
        id: req.params.uuid,
        tilejson: status.tileJson
      });

    case "FAILED":
      return res.json({
        status: "FAILED",
        id: req.params.uuid,
        error: status.error
      });
    default:
      return res.status(500).json({
        error: "Invalid Status",
        message: util.format("Invalid status found: '%j'.", status)
      });
    }
  });
});

/**
 * Get a list of tilesets we know about. (Consider OAM Catalog the definitive
 * source, however.)
 */
app.get("/requests", function(req, res, next) {
  return tiler.listRequests(function(err, requests) {
    if (err) {
      return next(err);
    }

    return res.json(requests);
  });
});

/**
 * Get current system status.
 */
app.get("/status", function(req, res, next) {
  return res.json({
    pending: chance.natural(),
    processing: chance.natural()
  });
});

// error handling

app.use(function(err, req, res, next) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("Request body:", req.body);
    console.warn(err.stack);
  }

  var status = 500;

  if (err.name === "AssertionError") {
    status = 400;
  }

  return res.status(status).json({
    error: err.name,
    message: err.message
  });
});

app.listen(process.env.PORT || 8000, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
