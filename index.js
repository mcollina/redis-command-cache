
var LRU = require("lru-cache");

function CacheRedis(db, subDb) {
  if (!(this instanceof CacheRedis)) {
    return new CacheRedis(db, subDb);
  }

  this.db = db;
  this.subDb = subDb;

  var cache = new LRU({
    max: 500,
    maxAge: 1000 * 60 * 10 // 10 minutes
  });

  this._cache = cache;

  subDb.subscribe("invalidations");
  subDb.on("message", function undoCaching(channel, message) {
    if (channel === 'invalidations') cache.del(message);
  })
}

function createInvalidationMethod(method) {
  return function invalidate() {
    this.db[method].apply(this.db, arguments);
    this.db.publish("invalidations", arguments[0]);
    return this;
  }
}

CacheRedis.prototype.set = createInvalidationMethod("set");
CacheRedis.prototype.del = createInvalidationMethod("del");
CacheRedis.prototype.sadd = createInvalidationMethod("sadd");
CacheRedis.prototype.srem = createInvalidationMethod("srem");

function createCacheableMethod(type) {
  return function cacheable(key, cb) {
    var cache = this._cache;
    var cached = this._cache.get(key);

    if (cached) {
      cb(null, cached);
      return this;
    }

    this.db[type](key, function(err, value) {
      if (err) return cb(err);

      cache.set(key, value);
      cb(null, value);
    });

    return this;
  }
}

CacheRedis.prototype.get = createCacheableMethod("get");
CacheRedis.prototype.smembers = createCacheableMethod("smembers");

module.exports = CacheRedis;
