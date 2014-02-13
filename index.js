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

  subDb.subscribe('invalidations');
  subDb.on('message', function undoCaching(channel, message) {
    if (channel === 'invalidations') cache.del(message);
  });
}


function createInvalidationMethod(method) {
  return function invalidate() {
    this.db[method].apply(this.db, arguments);
    this.db.publish('invalidations', arguments[0]);
    return this;
  };
}

CacheRedis.prototype.set = createInvalidationMethod('set');
CacheRedis.prototype.del = createInvalidationMethod('del');
CacheRedis.prototype.sadd = createInvalidationMethod('sadd');
CacheRedis.prototype.srem = createInvalidationMethod('srem');


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
  };
}

CacheRedis.prototype.get = createCacheableMethod('get');
CacheRedis.prototype.smembers = createCacheableMethod('smembers');


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