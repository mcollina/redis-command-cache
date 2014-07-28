redis-command-cache [![Code Climate](https://codeclimate.com/github/mcollina/redis-command-cache.png)](https://codeclimate.com/github/mcollina/redis-command-cache)
===================

Sometimes we need to run at such an high pace that we cannot hit redis
every time. We must cache values locally, and invalidate it at any
change.

This module uses [lru-cache](https://www.npmjs.org/package/lru-cache).

Usage
-----

```javascript
var redis = require("redis");
var redisCache = require("redis-command-cache");

var size = 500; //Max size of local lru-cache, defaults to 500
var ttl = 600; //Time-to-live on local and redis cache in seconds, local defaults to 10
               //minutes, redis defaults to no ttl (always stays in redis cache)
var cache = redisCache(db.createClient(), db.createClient(), size, ttl);
// var cache = redisCache(db.createClient(), db.createClient()); => local size 500, ttl on local 10 min, no ttl on redis

cache.set("key", "aaa", function() {
  cache.get("key", function(err, value) {
    // this value is cached until another set happens
    // you might get stale data
  });
});
```

Supported Commands
------------------

The following commands have the same signature of node-redis, but they
invalidate all the connected caches.

* get()
* set()
* del()
* sadd()
* srem()
* smembers()

How
---

**redis-command-cache** uses two redis connections one of which is used for
a pubsub channel for key invalidations. It assumes that the number of
writes on cached data is lower than the number of reads by some order of
magnitude.

License
-------

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
