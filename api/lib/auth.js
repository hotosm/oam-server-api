"use strict";

var assert = require("assert"),
    path = require("path"),
    util = require("util");

var AWS = require('aws-sdk'),
    env = require("require-env");

var BUCKET = env.require("OAM_TILER_TOKEN_BUCKET"),
    KEY = env.require("OAM_TILER_TOKEN_KEY");

var s3 = new AWS.S3();

module.exports.fetchTokens = function retrieve(callback) {
  var params = {
    Bucket: BUCKET,
    Key: KEY
  };

  s3.getObject(params, function(err, data) {
    if (err) {
      return callback(err);
    } else {
      return callback(null, JSON.parse(data.Body.toString()).tokens);
    }
  });
};
