
var test = require("tap").test;
var redis = require("redis");
var cacheRedis = require("./");

function getClient() {
  var client = redis.createClient();
  client.unref();
  return client;
}

function getCache() {
  var setdb = getClient();
  var subdb = getClient();
  setdb.on("end", subdb.end.bind(subdb));

  return cacheRedis(setdb, subdb);
}

test("it execute a set and get", function(t) {
  var db = getCache();
  var expected = "value" + Math.random();
  db.set("key", expected, function() {
    db.get("key", function(err, value) {
      t.equal(value, expected);
      t.end();
    });
  });
});

test("it invalidates another cache", function(t) {
  var db1 = getCache();
  var db2 = getCache();
  var expected = "value" + Math.random();
  db1.set("key", "aaa", function() {
    db2.get("key", function(err, value) {
      t.equal(value, "aaa");
      db1.set("key", expected, function() {
        db2.get("key", function(err, value) {
          t.equal(value, expected);
          t.end();
        });
      });
    });
  });
});

test("it invalidates another cache on del", function(t) {
  var db1 = getCache();
  var db2 = getCache();
  var expected = "value" + Math.random();
  db1.set("key", "aaa", function() {
    db2.get("key", function(err, value) {
      db1.del("key", function() {
        db2.get("key", function(err, value) {
          t.equal(value, null);
          t.end();
        });
      });
    });
  });
});

test("it does not hit the db on multiple get", function(t) {
  var cache = getCache();
  cache.set("key", "aaa", function() {
    cache.get("key", function(err, value) {
      cache.db.get = function() {
        t.ok(false, "the get() method in the client should not be called here");
        t.end();
      };

      cache.get("key", function(err, value) {
        t.equal(value, "aaa");
        t.end();
      });
    });
  });
});
