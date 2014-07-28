/*
Copyright (c) 2014, Matteo Collina <hello@matteocollina.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the  following disclaimer.
2. Redistributions in binary form must reproduce the above  copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

'use strict';
var LRU = require('lru-cache');



function CacheRedis(db, subDb, maxSize, ttl) {
  if (!(this instanceof CacheRedis)) {
    return new CacheRedis(db, subDb);
  }
  this.db = db;
  this.subDb = subDb;
  this.ttl = ttl;

  var cache = new LRU({
    max: maxSize || 500,
    maxAge: ttl * 1000 || 1000 * 60 * 10 // 10 minutes
  });

  this._cache = cache;

  subDb.subscribe('invalidations');
  subDb.on('message', function undoCaching(channel, message) {
    if (channel === 'invalidations') cache.del(message);
  });
}


// Give advice to a redis command
// to publish invalidation.
//
function createInvalidationCommand(redisCommandName) {
  return function invalidate() {
    this.db[redisCommandName].apply(this.db, arguments);
    this.db.publish('invalidations', arguments[0]);
    return this;
  };
}

function createSetCommand() {
  return function invalidate() {
    this.db.set.apply(this.db, arguments);
    if (this.ttl) {
      this.db.expire(arguments[0], this.ttl);
    }
    this.db.publish('invalidations', arguments[0]);
    return this;
  };
}

CacheRedis.prototype.set = createSetCommand();
CacheRedis.prototype.del = createInvalidationCommand('del');
CacheRedis.prototype.sadd = createInvalidationCommand('sadd');
CacheRedis.prototype.srem = createInvalidationCommand('srem');


// Give advice to a redis command
// to check for query result in cache
// before either-or hitting database.
//
// If the database *is* hit then cache
// *that* result.
//
function createCacheableCommand(redisCommandName) {
  return function cacheable(key, cb) {
    var cache = this._cache;
    var cached = this._cache.get(key);

    if (cached) {
      cb(null, cached);
      return this;
    }

    this.db[redisCommandName](key, function(err, value) {
      if (err) return cb(err);

      cache.set(key, value);
      cb(null, value);
    });

    return this;
  };
}

CacheRedis.prototype.get = createCacheableCommand('get');
CacheRedis.prototype.smembers = createCacheableCommand('smembers');


function multiExec(cb) {
  this.db.exec(cb);
}

CacheRedis.prototype.multi = function multi() {
  var multi = Object.create(this);
  multi.db = this.db.multi();
  multi.exec = multiExec;

  return multi;
};



module.exports = CacheRedis;