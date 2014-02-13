cache-redis
===========

Sometimes we need to run at such an high pace that we cannot hit redis
every time. We must cache values locally, and invalidate it at any
change.

This modules uses [lru-cache](https://www.npmjs.org/package/lru-cache).

Usage
-----

```javascript
var redis = require("redis");
var cacheRedis = require("cache-redis");
var cache = cacheRedis(db.createClient(), db.createClient());

cache.set("key", "aaa", function() {
  cache.get("key", function(err, value) {
    // this value is cached until another set happens
    // you might get stale data
  });
});
```

How
---

__cache-redis__ uses two redis connections one of which is used for
a pubsub channel for key invalidations. It assumes that the number of
writes on cached data is lower than the number of reads by some order of
magnitude.

