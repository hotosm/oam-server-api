"use strict";

var assert = require("assert"),
    path = require("path"),
    util = require("util");

var AWS = require("aws-sdk"),
    debug = require("debug"),
    env = require("require-env");

var BUCKET = env.require("OAM_STATUS_BUCKET"),
    PREFIX = env.require("OAM_STATUS_PREFIX");

var log = debug("oam:status"),
    s3 = new AWS.S3();

module.exports.retrieve = function retrieve(jobId, callback) {
  var params = {
    Bucket: BUCKET,
    Key: path.join(PREFIX, jobId)
  };

  s3.getObject(params, function(err, data) {
    if (err) {
      return callback(err);
    }

    return callback(null, JSON.parse(data.Body.toString()));
  });
};

module.exports.create = function retrieve(jobId, callback) {
  var status = {
    jobId: jobId,
    status: "PENDING",
    stage: "PENDING"
  };
  var statusKey = path.join(PREFIX, jobId);
  var statusPath = util.format("s3://%s/%s", BUCKET, statusKey);

  var params = {
    Bucket: BUCKET,
    Key: statusKey,
    ACL: "bucket-owner-full-control",
    Body: JSON.stringify(status)
  };

  log("Writing status");

  return s3.putObject(params, function(err, data) {
    if (err) {
      log("Error writing to %s", statusPath);
      return callback(err);
    }

    log("Wrote status to %s", statusPath);
    log(status);
    return callback();
  });
};
