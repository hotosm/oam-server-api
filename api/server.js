"use strict";

var assert = require("assert"),
    util = require("util");

var bodyParser = require("body-parser"),
    chance = require("chance"),
    express = require("express"),
    morgan = require("morgan"),
    uuid = require("uuid");

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
    assert.equal("application/json", req.headers["content-type"], "Payload must be 'application/json'");
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

  return res.status(202).json({
    status: "PENDING",
    id: uuid.v4(),
    queued_at: new Date()
  });
});

/**
 * Get info about a tiling request.
 */
app.get("/info/:uuid", function(req, res, next) {
  // predictable responses for debugging
  switch (req.params.uuid) {
  case "pending":
    return res.json({
      status: "PENDING",
      id: req.params.uuid,
      queued_at: chance.date()
    });

  case "processing":
    return res.json({
      status: "PROCESSING",
      id: req.params.uuid,
      queued_at: chance.date(),
      started_at: chance.date(),
      message: "Reprojecting"
    });

  case "completed":
    return res.json({
      status: "COMPLETED",
      id: req.params.uuid,
      queued_at: chance.date(),
      started_at: chance.date(),
      completed_at: chance.date(),
      // TODO fetch this from a TileJSON file stored with the tiles (and cache
      // it)
      tilejson: {
        tilejson: "1.0.0",
        name: "OpenStreetMap",
        description: "A free editable map of the whole world.",
        version: "1.0.0",
        attribution: "(c) OpenStreetMap contributors, CC-BY-SA",
        scheme: "xyz",
        tiles: [
            "http://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "http://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "http://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
        ],
        minzoom: 0,
        maxzoom: 18,
        bounds: [ -180, -85, 180, 85 ]
      }
    });

  case "failed":
    return res.json({
      status: "FAILED",
      id: req.params.uuid,
      queued_at: chance.date(),
      started_at: chance.date(),
      failed_at: chance.date(),
      error: "TilingFailed",
      message: "Tiling these images failed for no particularly good reason"
    });
  }

  return res.status(404).json({
    error: "NotFound",
    message: util.format("'%s' not found.", req.params.uuid)
  });
});

/**
 * Get a list of tilesets we know about. (Consider OAM Catalog the definitive
 * source, however.)
 */
app.get("/tilesets", function(req, res, next) {
  // TODO fetch all available TileJSON from S3
  return res.json({
    tilesets: [
      {
        tilejson: "1.0.0",
        name: "OpenStreetMap",
        description: "A free editable map of the whole world.",
        version: "1.0.0",
        attribution: "(c) OpenStreetMap contributors, CC-BY-SA",
        scheme: "xyz",
        tiles: [
            "http://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "http://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "http://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
        ],
        minzoom: 0,
        maxzoom: 18,
        bounds: [ -180, -85, 180, 85 ]
      }
    ]
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
    console.warn(err.stack);
  }

  return res.status(500).json({
    error: err.name,
    message: err.message
  });
});

app.listen(process.env.PORT || 8000, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
