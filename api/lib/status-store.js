"use strict";

var assert = require("assert"),
    path = require("path"),
    util = require("util");

var AWS = require('aws-sdk'),
    env = require("require-env");

var BUCKET = env.require("OAM_STATUS_BUCKET"),
    PREFIX = env.require("OAM_STATUS_PREFIX");

var s3 = new AWS.S3();

module.exports.retrieve = function retrieve(jobId, callback) {
  var params = {
    Bucket: BUCKET,
    Key: path.join(PREFIX, jobId)
  };

  s3.getObject(params, function(err, data) {
    if (err) {
      return callback(err);
    } else {
      return callback(null, JSON.parse(data.Body.toString()));
    }
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
    ACL: 'bucket-owner-full-control',
    Body: JSON.stringify(status)
  };
  console.log("Writing status");
  s3.putObject(params, function(err, data) {
    if (err) {
      console.log("Error writing to %s", statusPath);
      return callback(err);
    } else {
      console.log("Wrote status to %s", statusPath);
      console.log(JSON.stringify(status, null, 2));
      return callback();
    }
  });
};
