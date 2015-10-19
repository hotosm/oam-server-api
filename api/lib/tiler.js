"use strict";

var assert = require("assert"),
    path = require("path"),
    util = require("util");

var AWS = require("aws-sdk"),
    env = require("require-env");

var shell = require("./shell");

var SMALL_CLUSTER_SIZE = env.require("OAM_SMALL_CLUSTER_SIZE"),
    MED_CLUSTER_SIZE = env.require("OAM_MED_CLUSTER_SIZE"),
    LARGE_CLUSTER_SIZE = env.require("OAM_LARGE_CLUSTER_SIZE"),
    SMALL_IMAGE_COUNT = env.require("OAM_SMALL_IMAGE_COUNT"),
    MED_IMAGE_COUNT = env.require("OAM_MED_IMAGE_COUNT"),
    KEYNAME = env.require("OAM_EMR_KEYNAME"),
    MASTER_INSTANCE_TYPE = env.require("OAM_EMR_MASTER_INSTANCE_TYPE"),
    WORKER_INSTANCE_TYPE = env.require("OAM_EMR_WORKER_INSTANCE_TYPE"),
    WORKER_INSTANCE_BIDPRICE = env.require("OAM_EMR_WORKER_INSTANCE_BIDPRICE");

var emr = new AWS.EMR();
var s3 = new AWS.S3();

var BUCKET = "oam-server-tiler";
var WORKSPACE_PREFIX = "workspace";
var REQUEST_PREFIX = "requests";

var calculateClusterParameters = function calculateClusterParameters(images) {
  var len = images.length;

  var nodes = process.env.OAM_EMR_CLUSTER_SIZE;
  if (!nodes) {
    if (len < SMALL_IMAGE_COUNT) {
      nodes = SMALL_CLUSTER_SIZE;
    } else if (len < MED_IMAGE_COUNT) {
      nodes = MED_CLUSTER_SIZE;
    } else {
      nodes = LARGE_CLUSTER_SIZE;
    }
  }

  var cores = nodes;
  var executors = nodes * 4;

  return {
    numNodes: nodes,
    driverMemory: "2g",
    executorMemory: "2304m",
    numExecutors: executors,
    executorCores: 1
  };
};

var uploadRequest = function uploadRequest(bucket, key, request, callback) {
  var params = {
    Bucket: bucket,
    Key: key,
    ACL: "bucket-owner-full-control",
    Body: JSON.stringify(request)
  };

  s3.putObject(params, function(err, data) {
    if (err) {
      return callback(err);
    }

    console.warn(request);
    return callback();
  });
};

module.exports.launchJob = function launchJob(jobId, images, callback) {
  var workspaceBucket = "oam-server-tiler";
  var workspaceKey = "workspace/" + jobId;
  var workspace = util.format("s3://%s/%s", workspaceBucket, workspaceKey);
  var target = "s3://oam-tiles/" + jobId;
  var requestKey = path.join(REQUEST_PREFIX, jobId + ".json");
  var requestUri = util.format("s3://%s/%s", workspaceBucket, requestKey);
  var chunkResultUri = util.format("s3://%s/%s", workspaceBucket, path.join(workspaceKey, "step1_result.json"));

  var requestJson = {
    jobId: jobId,
    target: target,
    workspace: workspace,
    images: images,
    request_time: new Date().toISOString()
  };

  uploadRequest(workspaceBucket, requestKey, requestJson, function(err) {
    if (err) {
      return callback(err);
    }

    var clusterParams = calculateClusterParameters(images),
        instanceGroups = [];

    // add 1 master
    instanceGroups.push(util.format("Name=Master,InstanceCount=1,InstanceGroupType=MASTER,InstanceType=%s", MASTER_INSTANCE_TYPE));

    // add 2 core workers (reserved)
    // TODO make this configurable
    instanceGroups.push(util.format("Name=Workers,InstanceCount=%d,InstanceGroupType=CORE,InstanceType=%s", 2, WORKER_INSTANCE_TYPE));

    // add N task workers (spot)
    if (clusterParams.numNodes > 0) {
      instanceGroups.push(util.format("Name=SpotWorkers,InstanceCount=%d,BidPrice=%s,InstanceGroupType=TASK,InstanceType=%s", clusterParams.numNodes, WORKER_INSTANCE_BIDPRICE, WORKER_INSTANCE_TYPE));
    }

    var chunkStepArgs = [
      "--deploy-mode","cluster",
      "--driver-memory", clusterParams.driverMemory,
      "--num-executors", clusterParams.numExecutors,
      "--executor-memory", clusterParams.executorMemory,
      "--executor-cores", clusterParams.executorCores,
      "s3://oam-server-tiler/emr/chunk.py", requestUri
    ];

    var chunkStep = [
      "Name=Chunk",
      "ActionOnFailure=TERMINATE_CLUSTER",
      "Type=Spark",
      "Args=[" + chunkStepArgs.join() + "]"
    ].join();

    var mosaicStepArgs = [
      "--deploy-mode","cluster",
      "--driver-memory", clusterParams.driverMemory,
      "--num-executors", clusterParams.numExecutors,
      "--executor-memory", clusterParams.executorMemory,
      "--executor-cores", clusterParams.executorCores,
      "--class", "org.hotosm.oam.Main",
      "s3://oam-server-tiler/emr/mosaic.jar", chunkResultUri
    ];

    var mosaicStep = [
      "Name=Mosaic",
      "ActionOnFailure=TERMINATE_CLUSTER",
      "Type=Spark",
      "Args=[" + mosaicStepArgs.join() + "]"
    ].join();

    var args = [
      "emr", "create-cluster",
      "--name", "OAM Tiler for job " + jobId,
      "--log-uri", "s3://oam-server-tiler/emr/logs/",
      "--release-label", "emr-4.1.0",
      "--auto-terminate",
      "--use-default-roles",
      "--ec2-attributes", "KeyName=" + KEYNAME,
      "--bootstrap-action", "Path=s3://oam-server-tiler/emr/bootstrap.sh",
      "--applications", "Name=Spark",
      "--configurations", "https://oam-server-tiler.s3.amazonaws.com/emr/configurations.json",
      "--instance-groups"
    ].concat(instanceGroups);

    if (process.env.OAM_EMR_CLUSTER_ID) {
      args = [
        "emr", "add-steps",
        "--cluster-id", process.env.OAM_EMR_CLUSTER_ID
      ];
    }

    args = args.concat(["--steps", chunkStep, mosaicStep]);

    return shell("aws", args, { }, function(err) {
      if (err) {
        return callback(err);
      }

      return callback();
    });
  });
};

module.exports.fetchRequest = function fetchRequest(jobId, callback) {
  var params = {
    Bucket: BUCKET,
    Key: path.join(REQUEST_PREFIX, jobId + ".json")
  };

  s3.getObject(params, function(err, data) {
    if (err) {
      return callback(err);
    }

    return callback(null, JSON.parse(data.Body.toString()));
  });
};

module.exports.listRequests = function listRequests(callback) {
  var params = {
    Bucket: BUCKET,
    Prefix: REQUEST_PREFIX + "/"
  };

  return s3.listObjects(params, function(err, data) {
    if (err) {
      return callback(err);
    }

    var files = data.Contents.filter(function(content) {
      return content.Size > 0;
    });

    return callback(null, files.map(function(content) {
      return {
        jobId: path.parse(content.Key).name,
        request_time: content.LastModified
      };
    }));
  });
};
