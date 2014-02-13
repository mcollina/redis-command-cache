
var LRU = require("lru-cache");

function CacheRedis(db, subDb) {
  if (!(this instanceof CacheRedis)) {
    return new CacheRedis(db, subDb);
  }

  this.db = db;
  this.subDb = subDb;

  var cache = new LRU({
    max: 500,
    length: lengthResult,
    maxAge: 1000 * 60 * 10 // 10 minutes
  });

  this._cache = cache;

  subDb.subscribe("invalidations");
  subDb.on("message", function undoCaching(channel, message) {
    if (channel === 'invalidations') cache.del(message);
  })
}

CacheRedis.prototype.set = function set(key, value, cb) {
  this.db.publish("invalidations", key);
  this.db.set(key, value, cb);

  return this;
};

CacheRedis.prototype.get = function set(key, cb) {
  var cache = this._cache;
  var cached = this._cache.get(key);

  if (cached) {
    cb(null, cached);
    return this;
  }

  this.db.get(key, function(err, value) {
    if (err) return cb(err);

    cache.set(key, value);
    cb(null, value);
  });

  return this;
};

function lengthResult(value) {
  if (value instanceof Array) return value.length;
  return 1;
}

module.exports = CacheRedis;
