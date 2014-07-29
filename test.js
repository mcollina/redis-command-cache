
var test = require("tap").test;
var redis = require("redis");
var cacheRedis = require("./");

function getClient() {
  var client = redis.createClient();
  client.unref();
  return client;
}

function getCache(size, ttl) {
  var setdb = getClient();
  var subdb = getClient();

  setdb.on("end", function() {
    subdb.flushdb();
    subdb.quit();
  });

  return new cacheRedis(setdb, subdb, size, ttl);
}

function mockToNotOk(db, func, t) {
  db[func] = function() {
    t.ok(false, "the " + func + "() method in the client should not be called here");
    t.end();
  };
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

test("it expires", function(t) {
  var db = getCache(10, 1);
  var expected = "value" + Math.random();
  db.set("key", expected, function() {
    setTimeout(function(){
      db.db.get("key", function(err, value) {
        t.equal(value, null);
        t.end();
      });
    }, 2000);
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
        setTimeout(function() {
          db2.get("key", function(err, value) {
            t.equal(value, expected);
            t.end();
          });
        }, 10);
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
        setTimeout(function() {
          db2.get("key", function(err, value) {
            t.equal(value, null);
            t.end();
          });
        }, 10);
      });
    });
  });
});

test("it does not hit the db on multiple get", function(t) {
  var cache = getCache();
  cache.set("key", "aaa", function() {
    cache.get("key", function(err, value) {
      mockToNotOk(cache.db, "get", t);
      cache.get("key", function(err, value) {
        t.equal(value, "aaa");
        t.end();
      });
    });
  });
});

test("it executes sadd/smembers", function(t) {
  var db = getCache();
  db.sadd("aSet", "a", function() {
    db.sadd("aSet", "b", function() {
      db.smembers("aSet", function(err, values) {
        t.deepEqual(values, ["b", "a"]);
        t.end();
      });
    });
  });
});

test("it caches smembers", function(t) {
  var db = getCache();
  db.sadd("aSet", "a", function() {
    db.smembers("aSet", function(err, values) {
      mockToNotOk(db.db, "smembers", t);
      db.smembers("aSet", function(err, values) {
        t.end();
      });
    });
  });
});

test("it invalidates on sadd", function(t) {
  var db = getCache();
  db.sadd("aSet", "a", function() {
    db.smembers("aSet", function(err, values) {
      db.sadd("aSet", "b", function() {
        db.smembers("aSet", function(err, values) {
          t.deepEqual(values, ["b", "a"]);
          t.end();
        });
      });
    });
  });
});

test("it invalidates on srem", function(t) {
  var db = getCache();
  db.sadd("aSet", "a")
  db.sadd("aSet", "b", function() {
    db.smembers("aSet", function(err, values) {
      t.deepEqual(values, ["b", "a"]);
      db.srem("aSet", "a", function() {
        setTimeout(function() {
            db.smembers("aSet", function(err, values) {
              t.deepEqual(values, ["b"]);
              t.end();
            });
        }, 10);
      });
    });
  });
});

test("it should support multi", function(t) {
  var db = getCache();
  var multi = db.multi();
  multi.sadd("aSet", "a");
  multi.sadd("aSet", "b");
  multi.exec(function() {
    db.smembers("aSet", function(err, values) {
      t.deepEqual(values, ["b", "a"]);
      t.end();
    });
  });
});
