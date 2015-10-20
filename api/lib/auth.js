"use strict";

var assert = require("assert"),
    path = require("path"),
    util = require("util");

var AWS = require("aws-sdk"),
    env = require("require-env"),
    LRU = require("lru-cache");

var BUCKET = env.require("OAM_TILER_TOKEN_BUCKET"),
    KEY = env.require("OAM_TILER_TOKEN_KEY");

var cache = LRU({
      maxAge: 5 * 60e3
    }),
    s3 = new AWS.S3();

module.exports.fetchTokens = function retrieve(callback) {
  var tokens = cache.get("tokens");

  if (tokens) {
    return callback(null, tokens);
  }

  var params = {
    Bucket: BUCKET,
    Key: KEY
  };

  return s3.getObject(params, function(err, data) {
    if (err) {
      return callback(err);
    }

    return callback(null, JSON.parse(data.Body.toString()).tokens);
  });
};
