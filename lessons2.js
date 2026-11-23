/* The rest of the course. Same format as lessons.js. Coordinates are
   screen-aligned: x → right (about -8..8), y → down (about -4..4). */
(function () {
  const E = (kind, x, y, label, extra = {}) => ({ kind, x, y, label, ...extra });
  const L = (from, to, extra = {}) => ({ from, to, ...extra });
  const T = (text, tone = 'sand') => ({ text, tone });
  const tags = (...t) => ({ tags: t });
  const st = (short, chapter, title, body, o, scene) => ({ short, chapter, title, body, ...o, scene });
  const recap = (items, next) => [`<ul class="takeaways">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`].concat(next ? [] : []);
  const nextUp = (t) => ({ kind: 'next', text: `Next up: <b>${t}</b>.` });
  const users = (x = -7, y = 0, extra) => E('users', x, y, 'Users', extra);
  const R = {};

  // ======================= FOUNDATIONS =======================
  R['latency-throughput'] = {
    subtitle: 'How long one request takes vs how many you can finish per second.',
    tags: [['Beginner', 'mint'], ['~5 min', 'sand'], ['Performance', 'violet']], legend: ['req', 'res', 'err'],
    steps: [
      st('Latency', 'concept', 'Latency: time for one trip', ['<span class="term">Latency</span> is how long a single request takes, start to finish. Users feel it directly — every 100 ms makes a page feel slower.'],
        { metrics: { Latency: '50 ms', 'Req/s': '20' }, changes: ['One request at a time'] },
        { entities: { users: users(), s: E('server', 3, 0, 'Server', tags(T('50 ms each', 'green'))) }, links: { l: L('users', 's', { label: '50 ms' }) }, flows: [{ route: ['users', 's'], bounce: true, rate: 1, speed: 0.7 }] }),
      st('Throughput', 'concept', 'Throughput: work per second', ['<span class="term">Throughput</span> is how many requests the system completes per second. A server with 8 workers that each take 50 ms can finish about <b>160 req/s</b>.', 'Latency is the speed of one car; throughput is cars per hour on the highway.'],
        { metrics: { Latency: '50 ms', 'Req/s': '160' }, good: ['Req/s'], callout: { kind: 'insight', text: 'Throughput ≈ concurrency ÷ latency (Little’s law).' } },
        { entities: { users: users(), s: E('server', 3, 0, 'Server', tags(T('8 workers', 'blue'))) }, links: { l: L('users', 's') }, flows: [{ route: ['users', 's'], bounce: true, rate: 6 }] }),
      st('Saturation', 'problem', 'Past capacity, latency explodes', ['Send 300 req/s at a server that can do 160. The extra requests wait in line, so latency climbs from 50 ms to seconds — and eventually requests time out.', 'Latency stays flat until about 70–80% utilisation, then shoots up.'],
        { metrics: { Arrivals: '300/s', Capacity: '160/s', p99: '4.2 s' }, bad: ['p99'], callout: { kind: 'warn', text: 'Run servers at ~60–70% busy so spikes don’t push you over the cliff.' } },
        { entities: { users: users(), s: E('server', 3, 0, 'Server', { showCount: true, count: 9, tags: [T('100% busy', 'red')] }) }, links: { l: L('users', 's') }, flows: [{ route: ['users', 's'], bounce: true, rate: 9, delay: { s: 0.6 }, drop: { at: 's', p: 0.2 } }] }),
      st('Recap', 'recap', 'Two different numbers', recap(['<b>Latency</b> = time per request (watch p95/p99, not the average).', '<b>Throughput</b> = requests per second.', 'Near full utilisation, queues form and latency explodes.', 'Add capacity <i>before</i> you hit the knee of the curve.']),
        { metrics: { Latency: '50 ms', 'Req/s': '160' }, callout: nextUp('Napkin Math') },
        { entities: { users: users(), s: E('server', 3, 0, 'Server') }, links: { l: L('users', 's') }, flows: [{ route: ['users', 's'], bounce: true, rate: 4 }] }),
    ],
  };

  R['napkin-math'] = {
    subtitle: 'Estimate load, storage and bandwidth in a minute — before designing anything.',
    tags: [['Beginner', 'mint'], ['~6 min', 'sand'], ['Estimation', 'violet']], legend: ['req', 'res'],
    steps: [
      st('Users → QPS', 'concept', 'From users to requests per second', ['Start with daily active users. 10M DAU × 20 requests each = 200M requests/day.', 'A day has ~86,400 s — call it <b>100k</b>. So 200M / 100k ≈ <b>2,000 req/s</b> on average. Peak is usually 2–3× that.'],
        { metrics: { DAU: '10M', 'Avg QPS': '2k', 'Peak QPS': '5k' }, callout: { kind: 'tip', text: 'Round aggressively. You want the order of magnitude, not three decimals.' } },
        { entities: { users: users(-6, 0, tags(T('10M / day', 'green'))), s: E('server', 2, 0, 'Service', tags(T('~2k req/s', 'blue'))) }, links: { l: L('users', 's', { label: '200M / day' }) }, flows: [{ route: ['users', 's'], bounce: true, rate: 4 }] }),
      st('Storage', 'technique', 'How much disk?', ['If 1M users post one 1 KB item a day: 1 GB/day → <b>365 GB/year</b>. With 3 replicas, ~1 TB/year.', 'Photos change everything: 1M × 200 KB = 200 GB/day — that belongs in object storage.'],
        { metrics: { 'Per day': '1 GB', 'Per year': '365 GB', 'With 3×': '~1.1 TB' } },
        { entities: { s: E('server', -4, 0, 'Service'), db: E('db', 2, -2, 'Database', tags(T('365 GB / yr', 'violet'))), obj: E('store', 2.5, 2.5, 'Object store', tags(T('73 TB / yr', 'amber'))) }, links: { a: L('s', 'db'), b: L('s', 'obj') }, flows: [{ route: ['s', ['db', 'obj']], pick: 'rr', kind: 'msg', rate: 2 }] }),
      st('Servers', 'technique', 'How many machines?', ['If one server handles ~1,000 req/s for your workload, a 5k req/s peak needs 5 — plus headroom and redundancy, so run <b>8</b>.'],
        { metrics: { 'Peak QPS': '5k', 'Per server': '1k', Servers: '8' }, good: ['Servers'] },
        { entities: { users: users(), a: E('server', 2, -3.7, 'Server ×8'), b: E('server', 2, 0, ''), c: E('server', 2, 3.7, '') }, links: { a: L('users', 'a', { style: 'dashed' }), b: L('users', 'b', { style: 'dashed' }), c: L('users', 'c', { style: 'dashed' }) }, flows: [{ route: ['users', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 5 }] }),
      st('Recap', 'recap', 'Numbers worth memorising', recap(['1 day ≈ 10<sup>5</sup> seconds.', 'Memory read ~100 ns · SSD read ~100 µs · cross-region trip ~100 ms.', '1M users × 1 KB = 1 GB.', 'Always add peak factor, replication and headroom.']),
        { metrics: { 'Day': '≈100k s' }, callout: nextUp('Vertical vs Horizontal Scaling') },
        { entities: { users: users(), s: E('server', 2, 0, 'Service') }, links: { l: L('users', 's') }, flows: [{ route: ['users', 's'], bounce: true, rate: 3 }] }),
    ],
  };

  // ======================= SCALING =======================
  const lbPool = (o = {}) => ({ users: users(), lb: E('lb', -2.2, 0, 'Load balancer', o.lb), a: E('server', 2.5, -3.7, 'Server A', o.a), b: E('server', 2.5, 0, 'Server B', o.b), c: E('server', 2.5, 3.7, 'Server C', o.c) });
  const lbLinks = { u: L('users', 'lb'), la: L('lb', 'a'), lb_: L('lb', 'b'), lc: L('lb', 'c') };

  R['stateless'] = {
    subtitle: 'Keep no user data on the server, so any server can answer any request.',
    tags: [['Beginner', 'mint'], ['~5 min', 'sand'], ['Scaling', 'violet']], legend: ['req', 'res', 'err'],
    steps: [
      st('Sticky state', 'problem', 'Alice’s cart lives on Server A', ['Server A keeps Alice’s session (login, cart) in its memory. The load balancer sends her next request to B — which has never heard of her. She’s logged out, cart empty.'],
        { metrics: { 'Lost sessions': '66%' }, bad: ['Lost sessions'] },
        { entities: lbPool({ a: tags(T('Alice’s cart', 'violet')), b: tags(T('who?', 'red')), c: tags(T('who?', 'red')) }), links: lbLinks, flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 2, speed: 0.8 }] }),
      st('Sticky LB', 'technique', 'Band-aid: sticky sessions', ['The LB can pin each user to one server with a cookie. It works — until that server dies or you scale down, and every pinned user loses their session. Load also gets uneven.'],
        { metrics: { 'Lost sessions': '0%', Balance: 'uneven' }, bad: ['Balance'], callout: { kind: 'warn', text: 'Sticky sessions fight against autoscaling.' } },
        { entities: lbPool({ lb: tags(T('sticky', 'amber')), a: tags(T('busy', 'amber')) }), links: lbLinks, flows: [{ route: ['users', 'lb', 'a'], bounce: true, rate: 2.5 }, { route: ['users', 'lb', ['b', 'c']], pick: 'rr', bounce: true, rate: 0.6 }] }),
      st('Shared store', 'technique', 'Move state out of the server', ['Put sessions in a shared store (Redis) or a signed token the client carries. Now servers are <span class="term">stateless</span>: any of them can serve Alice, and you can add or kill servers freely.'],
        { metrics: { 'Lost sessions': '0%', Balance: 'even' }, good: ['Lost sessions', 'Balance'], changes: ['+ Session store', '~ Servers hold no user state'] },
        { entities: { ...lbPool(), r: E('cache', 7, 0, 'Session store', tags(T('Redis', 'red'))) }, links: { ...lbLinks, ra: L('a', 'r', { style: 'dashed' }), rb: L('b', 'r', { style: 'dashed' }), rc: L('c', 'r', { style: 'dashed' }) }, flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 3 }, { route: [['a', 'b', 'c'], 'r'], pick: 'random', bounce: true, rate: 2, size: 4 }] }),
      st('Recap', 'recap', 'Servers are cattle, not pets', recap(['Never keep user state in server memory or local disk.', 'Sessions → shared cache or signed tokens (JWT).', 'Files → object storage.', 'Stateless servers make scaling and failover trivial.']), { callout: nextUp('Caching'), metrics: { Servers: 'interchangeable' } },
        { entities: { ...lbPool(), r: E('cache', 7, 0, 'Session store') }, links: { ...lbLinks, ra: L('a', 'r', { style: 'dashed' }), rb: L('b', 'r', { style: 'dashed' }), rc: L('c', 'r', { style: 'dashed' }) }, flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 3 }] }),
    ],
  };

  R['cdn'] = {
    subtitle: 'Serve static files from servers near your users.',
    tags: [['Beginner', 'mint'], ['~5 min', 'sand'], ['Performance', 'violet']], legend: ['req', 'res', 'hit'],
    steps: [
      st('Far away', 'problem', 'Every image crosses the ocean', ['Your servers are in Virginia. A user in Sydney loads a page with 40 images; each one travels ~16,000 km and back: <b>~250 ms</b> per request.'],
        { metrics: { 'Round trip': '250 ms', 'Page load': '3.1 s' }, bad: ['Page load'] },
        { entities: { u: E('users', -7, 0, 'Sydney'), o: E('server', 4, 0, 'Origin', tags(T('Virginia', 'blue'))) }, links: { l: L('u', 'o', { label: '250 ms', labelTone: 'red' }) }, flows: [{ route: ['u', 'o'], bounce: true, rate: 2, speed: 0.5 }] }),
      st('Edge cache', 'concept', 'A CDN caches at the edge', ['A <span class="term">CDN</span> runs hundreds of edge servers worldwide. The first Sydney user fetches from the origin; the edge keeps a copy; everyone after gets it from <b>20 ms</b> away.'],
        { metrics: { 'Edge hit': '95%', 'Round trip': '20 ms', 'Page load': '0.6 s' }, good: ['Page load'], changes: ['+ CDN edge in Sydney'] },
        { entities: { u: E('users', -7, 0, 'Sydney'), e: E('cdn', -2, 0, 'Edge', tags(T('Sydney PoP', 'green'))), o: E('server', 4.5, 0, 'Origin') }, links: { a: L('u', 'e', { label: '20 ms' }), b: L('e', 'o', { label: '250 ms', style: 'dashed' }) }, flows: [{ route: ['u', 'e', 'o'], hit: { at: 'e', p: 0.95 }, bounce: true, rate: 3 }] }),
      st('Invalidation', 'technique', 'Changing a cached file', ['Edges cache by URL for a TTL. To ship a new <code>app.js</code>, give it a new name — <code>app.3f9a1.js</code> — so edges fetch it fresh. Purging works too, but is slower.'],
        { metrics: { Strategy: 'hashed names' }, callout: { kind: 'tip', text: 'Long TTL + content-hashed filenames = fast and always fresh.' } },
        { entities: { u: E('users', -7, 0, 'Users'), e: E('cdn', -2, 0, 'Edge', tags(T('app.3f9a1.js', 'amber'))), o: E('server', 4.5, 0, 'Origin') }, links: { a: L('u', 'e'), b: L('e', 'o', { style: 'dashed' }) }, flows: [{ route: ['u', 'e', 'o'], hit: { at: 'e', p: 0.8 }, bounce: true, rate: 3 }] }),
      st('Recap', 'recap', 'Move bytes closer', recap(['CDNs cut latency by shrinking distance.', 'They also absorb huge traffic and DDoS.', 'Great for images, video, JS, CSS — and cacheable API responses.', 'Version filenames instead of purging.']), { callout: nextUp('SQL vs NoSQL'), metrics: { 'Edge hit': '95%' } },
        { entities: { u: E('users', -7, 0, 'Users'), e: E('cdn', -2, 0, 'Edge'), o: E('server', 4.5, 0, 'Origin') }, links: { a: L('u', 'e'), b: L('e', 'o', { style: 'dashed' }) }, flows: [{ route: ['u', 'e', 'o'], hit: { at: 'e', p: 0.95 }, bounce: true, rate: 3 }] }),
    ],
  };

  // ======================= DATA =======================
  const appDb = (dbExtra, appExtra) => ({ app: E('server', -4, 0, 'App', appExtra), db: E('db', 3, 0, 'Database', dbExtra) });

  R['sql-nosql'] = {
    subtitle: 'Tables with joins, or flexible documents that scale out easily?',
    tags: [['Beginner', 'mint'], ['~6 min', 'sand'], ['Databases', 'violet']], legend: ['req', 'res'],
    steps: [
      st('Relational', 'concept', 'SQL: tables and relations', ['A <span class="term">relational database</span> (Postgres, MySQL) stores rows in tables with a fixed schema, joins them with SQL, and guarantees <b>ACID</b> transactions.', 'Perfect when data is connected: users, orders, payments.'],
        { metrics: { Schema: 'strict', Joins: 'yes', Transactions: 'ACID' } },
        { entities: appDb(tags(T('users ⋈ orders', 'violet'))), links: { l: L('app', 'db', { label: 'SQL' }) }, flows: [{ route: ['app', 'db'], bounce: true, rate: 2 }] }),
      st('NoSQL', 'concept', 'NoSQL: many shapes', ['<span class="term">NoSQL</span> covers key-value (Redis, DynamoDB), document (MongoDB), wide-column (Cassandra) and graph (Neo4j) stores.', 'They trade joins and strict schemas for flexible data and easy horizontal scaling.'],
        { metrics: { Schema: 'flexible', Joins: 'rare', Scale: 'horizontal' } },
        { entities: { app: E('server', -4, 0, 'App'), a: E('db', 3, -3.7, 'Node 1'), b: E('db', 3, 0, 'Node 2'), c: E('db', 3, 3.7, 'Node 3') }, links: { a: L('app', 'a'), b: L('app', 'b'), c: L('app', 'c') }, flows: [{ route: ['app', ['a', 'b', 'c']], pick: 'random', bounce: true, rate: 4 }] }),
      st('Choosing', 'technique', 'How to choose', ['Start with SQL unless you have a reason not to. Reach for NoSQL when you need massive write throughput, simple key lookups at huge scale, or truly schemaless data.'],
        { metrics: { Default: 'SQL' }, callout: { kind: 'tip', text: 'Many systems use both: Postgres for orders, Redis for sessions, Cassandra for activity logs.' } },
        { entities: { app: E('server', -4, 0, 'App'), sql: E('db', 3, -2.5, 'Postgres', tags(T('orders', 'violet'))), kv: E('cache', 3, 2.5, 'Redis', tags(T('sessions', 'red'))) }, links: { a: L('app', 'sql'), b: L('app', 'kv') }, flows: [{ route: ['app', ['sql', 'kv']], pick: 'rr', bounce: true, rate: 3 }] }),
      st('Recap', 'recap', 'Fit the data', recap(['SQL: relations, transactions, ad-hoc queries.', 'NoSQL: scale-out, flexible schema, known access patterns.', 'Model around your <b>queries</b>, not just your entities.']), { callout: nextUp('Indexes'), metrics: {} },
        { entities: appDb(), links: { l: L('app', 'db') }, flows: [{ route: ['app', 'db'], bounce: true, rate: 2 }] }),
    ],
  };

  R['indexes'] = {
    subtitle: 'Find one row among millions without reading them all.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Databases', 'mint']], legend: ['req', 'res'],
    steps: [
      st('Full scan', 'problem', 'Reading every row', ['<code>SELECT * FROM users WHERE email = ?</code> on 50M rows with no index means scanning the whole table: <b>2 seconds</b> per login.'],
        { metrics: { Rows: '50M', 'Rows read': '50M', Query: '2 s' }, bad: ['Query'] },
        { entities: appDb(tags(T('full table scan', 'red'))), links: { l: L('app', 'db', { label: '2000 ms', labelTone: 'red' }) }, flows: [{ route: ['app', 'db'], bounce: true, rate: 1, delay: { db: 1.5 } }] }),
      st('B-tree', 'concept', 'An index is a sorted lookup', ['An <span class="term">index</span> keeps a sorted copy of a column (usually a B-tree) pointing to rows. Finding one email takes ~log₂(50M) ≈ <b>26 steps</b> instead of 50M.'],
        { metrics: { 'Rows read': '~3 pages', Query: '2 ms' }, good: ['Query'], changes: ['+ INDEX ON users(email)'] },
        { entities: appDb(tags(T('index on email', 'green'))), links: { l: L('app', 'db', { label: '2 ms' }) }, flows: [{ route: ['app', 'db'], bounce: true, rate: 3 }] }),
      st('The cost', 'problem', 'Indexes aren’t free', ['Every insert or update must also update every index. Ten indexes make writes slower and use more disk. Index the columns you actually filter and sort by.'],
        { metrics: { Indexes: '10', 'Write cost': '3×' }, bad: ['Write cost'], callout: { kind: 'tip', text: 'Use EXPLAIN to see whether a query uses an index.' } },
        { entities: appDb(tags(T('10 indexes', 'amber'), T('slow writes', 'red'))), links: { l: L('app', 'db') }, flows: [{ route: ['app', 'db'], bounce: true, rate: 2, kind: 'msg', delay: { db: 0.5 } }] }),
      st('Recap', 'recap', 'Index for your queries', recap(['Indexes turn scans into lookups.', 'Composite indexes follow the left-most prefix rule.', 'Each index taxes every write.', 'Measure with EXPLAIN.']), { callout: nextUp('Storage Engines'), metrics: { Query: '2 ms' } },
        { entities: appDb(), links: { l: L('app', 'db') }, flows: [{ route: ['app', 'db'], bounce: true, rate: 3 }] }),
    ],
  };

  R['storage-engines'] = {
    subtitle: 'B-trees vs LSM-trees: how databases lay bytes on disk.',
    tags: [['Advanced', 'violet'], ['~6 min', 'sand'], ['Databases', 'mint']], legend: ['req', 'msg'],
    steps: [
      st('B-tree', 'concept', 'B-trees update in place', ['Postgres and MySQL use <span class="term">B-trees</span>: fixed-size pages on disk, updated in place. Reads are fast and predictable; random writes cost disk seeks.'],
        { metrics: { Reads: 'fast', Writes: 'medium' } },
        { entities: { app: E('server', -4, 0, 'App'), d: E('store', 3, 0, 'B-tree pages') }, links: { l: L('app', 'd') }, flows: [{ route: ['app', 'd'], bounce: true, rate: 2 }] }),
      st('LSM', 'concept', 'LSM-trees append', ['Cassandra and RocksDB use <span class="term">LSM-trees</span>: writes go to an in-memory table and a log, then flush to sorted files on disk. Writes are sequential and very fast.'],
        { metrics: { Reads: 'medium', Writes: 'very fast' }, good: ['Writes'] },
        { entities: { app: E('server', -5, 0, 'App'), m: E('cache', 0, 0, 'Memtable'), s: E('store', 5, 0, 'SSTables') }, links: { a: L('app', 'm'), b: L('m', 's', { style: 'dashed' }) }, flows: [{ route: ['app', 'm'], kind: 'msg', rate: 5 }, { route: ['m', 's'], kind: 'msg', rate: 0.6, speed: 0.5 }] }),
      st('Compaction', 'technique', 'Compaction merges files', ['Over time many sorted files pile up, and reads must check several. Background <b>compaction</b> merges them and drops old values. It uses I/O, but keeps reads fast.'],
        { metrics: { Files: '12 → 3' }, callout: { kind: 'insight', text: 'Write-heavy → LSM. Read-heavy with updates → B-tree.' } },
        { entities: { m: E('cache', -3, 0, 'Memtable'), s: E('store', 3, 0, 'SSTables', tags(T('compacting', 'amber'))) }, links: { b: L('m', 's') }, flows: [{ route: ['m', 's'], kind: 'msg', rate: 1.5 }] }),
      st('Recap', 'recap', 'Pick by workload', recap(['B-tree: in-place pages, great reads.', 'LSM: append + compaction, great writes.', 'Both use a write-ahead log for durability.']), { callout: nextUp('Replication'), metrics: {} },
        { entities: { app: E('server', -4, 0, 'App'), d: E('db', 3, 0, 'Database') }, links: { l: L('app', 'd') }, flows: [{ route: ['app', 'd'], bounce: true, rate: 2 }] }),
    ],
  };

  const shards = (o = {}) => ({ app: E('server', -6, 0, 'App'), r: E('lb', -1.5, 0, 'Shard router', o.r), s1: E('db', 4, -3.7, 'Shard 1', o.s1), s2: E('db', 4, 0, 'Shard 2', o.s2), s3: E('db', 4, 3.7, 'Shard 3', o.s3) });
  const shardLinks = { a: L('app', 'r'), b: L('r', 's1'), c: L('r', 's2'), d: L('r', 's3') };

  R['sharding'] = {
    subtitle: 'Split one huge database into pieces so writes scale too.',
    tags: [['Intermediate', 'violet'], ['~6 min', 'sand'], ['Databases', 'mint']], legend: ['req', 'res'],
    steps: [
      st('Write wall', 'problem', 'One leader, too many writes', ['Replicas scaled reads, but every write still hits a single leader. At 50k writes/s, its disk and CPU are maxed out.'],
        { metrics: { Writes: '50k/s', 'Leader CPU': '100%' }, bad: ['Leader CPU'] },
        { entities: { app: E('server', -4, 0, 'App'), db: E('db', 3, 0, 'Leader', tags(T('CPU 100%', 'red'))) }, links: { l: L('app', 'db') }, flows: [{ route: ['app', 'db'], bounce: true, rate: 8, delay: { db: 0.4 } }] }),
      st('Shard key', 'concept', 'Split by a shard key', ['<span class="term">Sharding</span> divides rows across databases by a key — e.g. <code>user_id</code>. Each shard holds a slice and handles only its slice’s writes.'],
        { metrics: { Shards: '3', 'Per shard': '~17k/s' }, good: ['Per shard'], changes: ['+ 3 shards', '~ shard = hash(user_id) % 3'] },
        { entities: shards({ r: tags(T('hash(user_id) % 3', 'amber')) }), links: shardLinks, flows: [{ route: ['app', 'r', ['s1', 's2', 's3']], pick: 'random', bounce: true, rate: 6 }] }),
      st('Hot shard', 'problem', 'A celebrity breaks the balance', ['One user with 50M followers lives on Shard 2. All their traffic lands there, while the others idle. A bad key creates <b>hot spots</b>.'],
        { metrics: { 'Shard 2': '90%', 'Others': '15%' }, bad: ['Shard 2'], callout: { kind: 'warn', text: 'Cross-shard joins and transactions also get hard. Pick a key that keeps related data together.' } },
        { entities: shards({ s2: tags(T('hot!', 'red')) }), links: shardLinks, flows: [{ route: ['app', 'r', 's2'], bounce: true, rate: 6 }, { route: ['app', 'r', ['s1', 's3']], pick: 'rr', bounce: true, rate: 1 }] }),
      st('Recap', 'recap', 'Shard last, shard wisely', recap(['Sharding scales writes and storage.', 'The shard key decides everything — high cardinality, even spread.', 'Resharding is painful; consistent hashing helps.', 'Exhaust caching and replicas first.']), { callout: nextUp('Consistent Hashing'), metrics: { Shards: '3' } },
        { entities: shards(), links: shardLinks, flows: [{ route: ['app', 'r', ['s1', 's2', 's3']], pick: 'rr', bounce: true, rate: 5 }] }),
    ],
  };

  const ring = (n, extra = {}) => {
    const o = {};
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      o['n' + i] = E('db', 2 + Math.cos(a) * 4.5, Math.sin(a) * 3.6, `Node ${String.fromCharCode(65 + i)}`, extra['n' + i]);
    }
    return o;
  };
  const ringLinks = (n) => Object.fromEntries([...Array(n)].map((_, i) => ['l' + i, L('r', 'n' + i, { style: 'dashed' })]));
  const ringIds = (n) => [...Array(n)].map((_, i) => 'n' + i);

  R['consistent-hashing'] = {
    subtitle: 'Add or remove servers while moving as few keys as possible.',
    tags: [['Advanced', 'violet'], ['~6 min', 'sand'], ['Distributed', 'mint']], legend: ['req', 'res'],
    steps: [
      st('Modulo pain', 'problem', 'hash % N reshuffles everything', ['With <code>hash(key) % 4</code>, adding a 5th node changes the answer for ~80% of keys. Caches go cold; data must move everywhere.'],
        { metrics: { 'Keys moved': '80%' }, bad: ['Keys moved'] },
        { entities: { r: E('lb', -5, 0, 'Router', tags(T('hash % N', 'red'))), ...ring(4) }, links: ringLinks(4), flows: [{ route: ['r', ringIds(4)], pick: 'random', bounce: true, rate: 4 }] }),
      st('The ring', 'concept', 'Place nodes on a ring', ['Hash both nodes and keys onto a circle. A key belongs to the first node clockwise from it. Each node owns the arc before it.'],
        { metrics: { Nodes: '4' }, callout: { kind: 'insight', text: 'Virtual nodes — each server at many points on the ring — even out the arcs.' } },
        { entities: { r: E('lb', -5, 0, 'Router', tags(T('ring lookup', 'green'))), ...ring(4) }, links: ringLinks(4), flows: [{ route: ['r', ringIds(4)], pick: 'rr', bounce: true, rate: 4 }] }),
      st('Add a node', 'technique', 'Only neighbours move', ['Add Node E: it takes over part of one arc. Only ~1/N of keys move — the rest stay put.'],
        { metrics: { 'Keys moved': '20%' }, good: ['Keys moved'], changes: ['+ Node E'] },
        { entities: { r: E('lb', -5, 0, 'Router'), ...ring(5, { n4: tags(T('new', 'green')) }) }, links: ringLinks(5), flows: [{ route: ['r', ringIds(5)], pick: 'rr', bounce: true, rate: 5 }] }),
      st('Recap', 'recap', 'Minimal movement', recap(['Keys and nodes share one hash ring.', 'Adding/removing a node moves ~1/N of keys.', 'Virtual nodes balance load.', 'Used by DynamoDB, Cassandra, and many caches.']), { callout: nextUp('Unique IDs at Scale'), metrics: {} },
        { entities: { r: E('lb', -5, 0, 'Router'), ...ring(5) }, links: ringLinks(5), flows: [{ route: ['r', ringIds(5)], pick: 'random', bounce: true, rate: 5 }] }),
    ],
  };

  R['unique-ids'] = {
    subtitle: 'Generate IDs on many machines without them ever colliding.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Distributed', 'mint']], legend: ['req', 'res'],
    steps: [
      st('Auto-inc', 'problem', 'AUTO_INCREMENT needs one place', ['A single database counter is simple, but every insert must go through it. With shards, each one would hand out the same numbers.'],
        { metrics: { Bottleneck: 'yes' }, bad: ['Bottleneck'] },
        { entities: { a: E('server', -5, -3, 'App 1'), b: E('server', -5, 3, 'App 2'), db: E('db', 3, 0, 'Counter', tags(T('id = 1042', 'amber'))) }, links: { a: L('a', 'db'), b: L('b', 'db') }, flows: [{ route: [['a', 'b'], 'db'], pick: 'rr', bounce: true, rate: 4, delay: { db: 0.2 } }] }),
      st('UUID', 'technique', 'UUIDs: random 128 bits', ['Each machine generates a random <span class="term">UUID</span>. Collisions are practically impossible and no coordination is needed — but they’re long and not sortable by time, which hurts index locality.'],
        { metrics: { Size: '128 bit', Sortable: 'no' } },
        { entities: { a: E('server', -3, -3, 'App 1', tags(T('9f1c…', 'violet'))), b: E('server', -3, 3, 'App 2', tags(T('3a7e…', 'violet'))), db: E('db', 4, 0, 'Database') }, links: { a: L('a', 'db'), b: L('b', 'db') }, flows: [{ route: [['a', 'b'], 'db'], pick: 'rr', rate: 4 }] }),
      st('Snowflake', 'technique', 'Snowflake: time + machine + sequence', ['A 64-bit ID made of <b>timestamp</b> (41 bits) + <b>machine id</b> (10 bits) + <b>sequence</b> (12 bits). Unique, compact, and roughly sorted by time. Each machine makes 4,096 IDs per millisecond.'],
        { metrics: { Size: '64 bit', Sortable: 'yes', 'Per node': '4M/s' }, good: ['Sortable'], callout: { kind: 'warn', text: 'Clock skew matters: never let a node’s clock go backwards.' } },
        { entities: { a: E('worker', -3, -3, 'Node 1', tags(T('ts|01|seq', 'green'))), b: E('worker', -3, 3, 'Node 2', tags(T('ts|02|seq', 'green'))), db: E('db', 4, 0, 'Database') }, links: { a: L('a', 'db'), b: L('b', 'db') }, flows: [{ route: [['a', 'b'], 'db'], pick: 'rr', rate: 6 }] }),
      st('Recap', 'recap', 'Coordination-free IDs', recap(['Auto-increment: simple, single bottleneck.', 'UUID: no coordination, big and unordered.', 'Snowflake-style: compact, time-ordered, needs machine ids.']), { callout: nextUp('CAP & Consistency'), metrics: {} },
        { entities: { a: E('worker', -3, -3, 'Node 1'), b: E('worker', -3, 3, 'Node 2'), db: E('db', 4, 0, 'Database') }, links: { a: L('a', 'db'), b: L('b', 'db') }, flows: [{ route: [['a', 'b'], 'db'], pick: 'rr', rate: 4 }] }),
    ],
  };

  const twoDc = (o = {}) => ({ ua: E('users', -7, -3, 'Users EU'), ub: E('users', -7, 3, 'Users US'), a: E('db', 2, -3, 'Node EU', o.a), b: E('db', 2, 3, 'Node US', o.b) });

  R['cap'] = {
    subtitle: 'When the network splits, choose: stay consistent or stay available.',
    tags: [['Advanced', 'violet'], ['~6 min', 'sand'], ['Distributed', 'mint']], legend: ['req', 'res', 'err', 'msg'],
    steps: [
      st('Two copies', 'concept', 'Data in two places', ['Two database nodes, one in Europe and one in the US, replicate to each other. Users talk to the nearest one.'],
        { metrics: { Partition: 'no', Consistent: 'yes', Available: 'yes' } },
        { entities: twoDc(), links: { a: L('ua', 'a'), b: L('ub', 'b'), r: L('a', 'b', { style: 'dashed', label: 'replication' }) }, flows: [{ route: ['ua', 'a'], bounce: true, rate: 1.5 }, { route: ['ub', 'b'], bounce: true, rate: 1.5 }, { route: ['a', 'b'], kind: 'msg', rate: 1 }] }),
      st('Partition', 'problem', 'The link breaks', ['A <span class="term">network partition</span>: the nodes can’t talk. A write arrives in Europe. Should the US node keep answering with possibly old data?'],
        { metrics: { Partition: 'YES' }, bad: ['Partition'], callout: { kind: 'insight', text: 'CAP: during a Partition, pick Consistency or Availability.' } },
        { entities: twoDc({ a: tags(T('x = 2', 'green')), b: tags(T('x = 1 ?', 'amber')) }), links: { a: L('ua', 'a'), b: L('ub', 'b'), r: L('a', 'b', { style: 'broken' }) }, flows: [{ route: ['ua', 'a'], bounce: true, rate: 1.5 }, { route: ['ub', 'b'], bounce: true, rate: 1.5 }] }),
      st('Choose C', 'technique', 'CP: refuse rather than lie', ['A CP system makes the minority side reject requests until the partition heals. Data is never stale — but US users see errors. Banks and inventory often choose this.'],
        { metrics: { Consistent: 'yes', Available: 'partial' }, bad: ['Available'] },
        { entities: twoDc({ b: { tags: [T('read-only / 503', 'red')] } }), links: { a: L('ua', 'a'), b: L('ub', 'b'), r: L('a', 'b', { style: 'broken' }) }, flows: [{ route: ['ua', 'a'], bounce: true, rate: 1.5 }, { route: ['ub', 'b'], rate: 1.5, drop: { at: 'b', p: 1 } }] }),
      st('Choose A', 'technique', 'AP: answer, reconcile later', ['An AP system keeps both sides serving. Reads may be stale and writes may conflict; they’re merged when the link returns (<b>eventual consistency</b>). Social feeds and carts often choose this.'],
        { metrics: { Consistent: 'eventually', Available: 'yes' }, good: ['Available'] },
        { entities: twoDc({ a: tags(T('x = 2', 'green')), b: tags(T('x = 1 (stale)', 'amber')) }), links: { a: L('ua', 'a'), b: L('ub', 'b'), r: L('a', 'b', { style: 'broken' }) }, flows: [{ route: ['ua', 'a'], bounce: true, rate: 1.5 }, { route: ['ub', 'b'], bounce: true, rate: 1.5 }] }),
      st('Recap', 'recap', 'Partitions force a choice', recap(['Partitions happen; you can’t opt out of P.', 'CP: correct or nothing. AP: something, maybe stale.', 'PACELC: even without partitions, you trade latency vs consistency.']), { callout: nextUp('Consensus & Leader Election'), metrics: {} },
        { entities: twoDc(), links: { a: L('ua', 'a'), b: L('ub', 'b'), r: L('a', 'b', { style: 'dashed' }) }, flows: [{ route: ['ua', 'a'], bounce: true, rate: 1.5 }, { route: ['ub', 'b'], bounce: true, rate: 1.5 }, { route: ['a', 'b'], kind: 'msg', rate: 1 }] }),
    ],
  };

  const trio = (o = {}) => ({ n1: E('server', -4, 0, 'Node 1', o.n1), n2: E('server', 3, -3.7, 'Node 2', o.n2), n3: E('server', 3, 3.7, 'Node 3', o.n3) });
  const trioLinks = { a: L('n1', 'n2'), b: L('n1', 'n3'), c: L('n2', 'n3', { style: 'dashed' }) };

  R['consensus'] = {
    subtitle: 'Getting several machines to agree, even when some fail.',
    tags: [['Advanced', 'violet'], ['~7 min', 'sand'], ['Distributed', 'mint']], legend: ['msg', 'res', 'err'],
    steps: [
      st('Why agree', 'problem', 'Two leaders = split brain', ['If two nodes both think they’re leader, both accept writes and the data diverges. We need everyone to agree on <b>one</b> leader and one order of writes.'],
        { metrics: { Leaders: '2' }, bad: ['Leaders'] },
        { entities: trio({ n1: tags(T('leader', 'amber')), n2: tags(T('leader?!', 'red')) }), links: trioLinks, flows: [{ route: ['n1', 'n3'], kind: 'msg', rate: 1 }, { route: ['n2', 'n3'], kind: 'msg', rate: 1 }] }),
      st('Election', 'concept', 'Raft: vote for a leader', ['In <span class="term">Raft</span>, a node that hears no heartbeat becomes a candidate and asks for votes. With a <b>majority</b> (2 of 3), it becomes leader for that term.'],
        { metrics: { Leaders: '1', Quorum: '2 / 3' }, good: ['Leaders'] },
        { entities: trio({ n1: tags(T('leader · term 4', 'green')), n2: tags(T('voted ✓', 'sand')), n3: tags(T('voted ✓', 'sand')) }), links: trioLinks, flows: [{ route: ['n1', ['n2', 'n3']], pick: 'rr', kind: 'msg', bounce: true, backKind: 'res', rate: 2 }] }),
      st('Replicate', 'technique', 'Commit after a majority', ['The leader appends each write to its log and sends it to followers. Once a majority have it, the write is <b>committed</b>. One node can fail and nothing is lost.'],
        { metrics: { 'Tolerates': '1 failure' }, callout: { kind: 'insight', text: '2f + 1 nodes tolerate f failures. 5 nodes survive 2.' } },
        { entities: trio({ n1: tags(T('leader', 'green')), n3: { state: 'down' } }), links: { a: L('n1', 'n2'), b: L('n1', 'n3', { style: 'broken' }), c: L('n2', 'n3', { style: 'off' }) }, flows: [{ route: ['n1', ['n2', 'n3']], pick: 'rr', kind: 'msg', bounce: true, backKind: 'res', rate: 2 }] }),
      st('Recap', 'recap', 'Majorities keep order', recap(['Consensus = agree on a value/order despite failures.', 'Raft & Paxos use majority quorums.', 'Used by etcd, ZooKeeper, Consul, CockroachDB.', 'Don’t build it yourself — use one of those.']), { callout: nextUp('Transactions & Isolation'), metrics: {} },
        { entities: trio({ n1: tags(T('leader', 'green')) }), links: trioLinks, flows: [{ route: ['n1', ['n2', 'n3']], pick: 'rr', kind: 'msg', bounce: true, backKind: 'res', rate: 2 }] }),
    ],
  };

  R['transactions'] = {
    subtitle: 'All-or-nothing changes, and what happens when they run at the same time.',
    tags: [['Advanced', 'violet'], ['~6 min', 'sand'], ['Databases', 'mint']], legend: ['req', 'res', 'err'],
    steps: [
      st('Half done', 'problem', 'Money vanishes', ['Transfer $100: subtract from Alice, add to Bob. The server crashes between the two steps — Alice lost $100, Bob got nothing.'],
        { metrics: { Alice: '-$100', Bob: '+$0' }, bad: ['Bob'] },
        { entities: { app: E('server', -4, 0, 'App', { state: 'down' }), db: E('db', 3, 0, 'Database', tags(T('half-applied', 'red'))) }, links: { l: L('app', 'db', { style: 'broken' }) }, flows: [] }),
      st('ACID', 'concept', 'Transactions are all-or-nothing', ['Wrap both updates in <code>BEGIN … COMMIT</code>. <b>Atomic</b>: both or neither. <b>Consistent</b>: rules hold. <b>Isolated</b>: others don’t see half-done work. <b>Durable</b>: committed means saved.'],
        { metrics: { Alice: '-$100', Bob: '+$100' }, good: ['Bob'] },
        { entities: { app: E('server', -4, 0, 'App'), db: E('db', 3, 0, 'Database', tags(T('BEGIN … COMMIT', 'green'))) }, links: { l: L('app', 'db') }, flows: [{ route: ['app', 'db'], bounce: true, rate: 2 }] }),
      st('Isolation', 'technique', 'Concurrent transactions', ['Two withdrawals read balance $100 at once and both succeed: <b>lost update</b>. Isolation levels trade safety for speed: Read Committed → Repeatable Read → <b>Serializable</b>.'],
        { metrics: { Level: 'Serializable' }, callout: { kind: 'tip', text: 'Use SELECT … FOR UPDATE or optimistic version checks for read-modify-write.' } },
        { entities: { a: E('server', -5, -3, 'Tx 1'), b: E('server', -5, 3, 'Tx 2'), db: E('db', 3, 0, 'Database', tags(T('row lock', 'amber'))) }, links: { a: L('a', 'db'), b: L('b', 'db') }, flows: [{ route: ['a', 'db'], bounce: true, rate: 1 }, { route: ['b', 'db'], bounce: true, rate: 1, delay: { db: 0.8 } }] }),
      st('Recap', 'recap', 'Safe changes', recap(['ACID transactions prevent half-done writes.', 'Weaker isolation = faster but allows anomalies.', 'Across services, use sagas instead.']), { callout: nextUp('Files & Media'), metrics: {} },
        { entities: { app: E('server', -4, 0, 'App'), db: E('db', 3, 0, 'Database') }, links: { l: L('app', 'db') }, flows: [{ route: ['app', 'db'], bounce: true, rate: 2 }] }),
    ],
  };

  R['files'] = {
    subtitle: 'Store photos and videos in object storage, not your database.',
    tags: [['Beginner', 'mint'], ['~5 min', 'sand'], ['Storage', 'violet']], legend: ['req', 'res', 'msg'],
    steps: [
      st('Blobs in DB', 'problem', 'Images in the database', ['Storing 5 MB photos as database blobs bloats backups, slows queries, and makes every byte flow through your app servers.'],
        { metrics: { 'DB size': '4 TB', Backups: '9 h' }, bad: ['Backups'] },
        { entities: { users: users(), app: E('server', -1, 0, 'App'), db: E('db', 5, 0, 'Database', tags(T('4 TB of blobs', 'red'))) }, links: { a: L('users', 'app'), b: L('app', 'db') }, flows: [{ route: ['users', 'app', 'db'], bounce: true, rate: 2, delay: { db: 0.5 } }] }),
      st('Object store', 'concept', 'Object storage', ['<span class="term">Object storage</span> (S3, GCS) stores files by key, cheaply and durably (11 nines). The database keeps only the key and metadata.'],
        { metrics: { 'DB size': '20 GB', Durability: '99.999999999%' }, good: ['DB size'] },
        { entities: { users: users(), app: E('server', -1, 0, 'App'), db: E('db', 5, -3, 'Database', tags(T('metadata', 'violet'))), s3: E('store', 5, 3, 'Object store') }, links: { a: L('users', 'app'), b: L('app', 'db'), c: L('app', 's3') }, flows: [{ route: ['users', 'app', ['db', 's3']], pick: 'rr', bounce: true, rate: 3 }] }),
      st('Direct upload', 'technique', 'Pre-signed URLs', ['The app hands the client a short-lived <b>pre-signed URL</b>; the client uploads straight to storage. Bytes never touch your servers. A CDN serves downloads.'],
        { metrics: { 'App bandwidth': '~0' }, good: ['App bandwidth'] },
        { entities: { users: users(), app: E('server', -1, -3.5, 'App'), s3: E('store', 4, 2, 'Object store'), cdn: E('cdn', -1, 4, 'CDN') }, links: { a: L('users', 'app'), c: L('users', 's3', { label: 'PUT', style: 'dashed' }), d: L('cdn', 's3') }, flows: [{ route: ['users', 'app'], bounce: true, rate: 1 }, { route: ['users', 's3'], kind: 'msg', rate: 1.5 }] }),
      st('Recap', 'recap', 'Bytes go to blob storage', recap(['DB stores metadata; object store stores bytes.', 'Upload directly with pre-signed URLs.', 'Serve via CDN; process (thumbnails) via a queue.']), { callout: nextUp('REST, RPC & GraphQL'), metrics: {} },
        { entities: { users: users(), app: E('server', -1, 0, 'App'), s3: E('store', 5, 0, 'Object store') }, links: { a: L('users', 'app'), c: L('app', 's3') }, flows: [{ route: ['users', 'app', 's3'], bounce: true, rate: 2 }] }),
    ],
  };

  // ======================= COMMUNICATION =======================
  R['apis'] = {
    subtitle: 'Three styles for services to talk: resources, functions, or queries.',
    tags: [['Beginner', 'mint'], ['~6 min', 'sand'], ['APIs', 'violet']], legend: ['req', 'res'],
    steps: [
      st('REST', 'concept', 'REST: resources over HTTP', ['<span class="term">REST</span> models nouns as URLs and uses HTTP verbs: <code>GET /users/42</code>, <code>POST /orders</code>. Simple, cacheable, universal.'],
        { metrics: { Format: 'JSON', Caching: 'HTTP' } },
        { entities: { c: E('client', -5, 0, 'Browser'), s: E('server', 3, 0, 'API', tags(T('GET /users/42', 'green'))) }, links: { l: L('c', 's') }, flows: [{ route: ['c', 's'], bounce: true, rate: 2 }] }),
      st('RPC', 'concept', 'RPC: call a function remotely', ['<span class="term">gRPC</span> calls methods like <code>GetUser(42)</code> using compact binary Protobuf over HTTP/2. Fast and strongly typed — ideal between internal services.'],
        { metrics: { Format: 'Protobuf', Speed: 'fast' }, good: ['Speed'] },
        { entities: { a: E('server', -4, 0, 'Orders svc'), b: E('server', 3, 0, 'Users svc', tags(T('GetUser(42)', 'blue'))) }, links: { l: L('a', 'b', { label: 'HTTP/2' }) }, flows: [{ route: ['a', 'b'], bounce: true, rate: 4, speed: 1.3 }] }),
      st('GraphQL', 'concept', 'GraphQL: ask for exactly what you need', ['The client sends one query describing the shape it wants; the server resolves it from many sources. No over-fetching, one round trip — but caching and cost control are harder.'],
        { metrics: { 'Round trips': '1' } },
        { entities: { c: E('client', -6, 0, 'Mobile app'), g: E('lb', -1, 0, 'GraphQL'), u: E('server', 4, -3.7, 'Users'), p: E('server', 4, 0, 'Posts'), m: E('db', 4, 3.7, 'Media') }, links: { a: L('c', 'g'), b: L('g', 'u'), d: L('g', 'p'), e: L('g', 'm') }, flows: [{ route: ['c', 'g', ['u', 'p', 'm']], pick: 'rr', bounce: true, rate: 3 }] }),
      st('Recap', 'recap', 'Pick per audience', recap(['Public APIs → REST.', 'Service-to-service → gRPC.', 'Many clients with varied needs → GraphQL.', 'Version your API and keep changes backward-compatible.']), { callout: nextUp('Message Queues'), metrics: {} },
        { entities: { c: E('client', -5, 0, 'Client'), s: E('server', 3, 0, 'API') }, links: { l: L('c', 's') }, flows: [{ route: ['c', 's'], bounce: true, rate: 2 }] }),
    ],
  };

  const pubsub = (o = {}) => ({ p: E('server', -6, 0, 'Orders svc'), t: E('queue', -0.5, 0, 'Topic: order.placed'), e: E('worker', 5, -3.7, 'Email', o.e), i: E('worker', 5, 0, 'Inventory', o.i), a: E('worker', 5, 3.7, 'Analytics', o.a) });
  const psLinks = { a: L('p', 't'), b: L('t', 'e'), c: L('t', 'i'), d: L('t', 'a') };

  R['pubsub'] = {
    subtitle: 'Publish one event; let any number of services react to it.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Async', 'mint']], legend: ['msg'],
    steps: [
      st('Coupled', 'problem', 'The order service calls everyone', ['After an order, the service calls Email, Inventory and Analytics directly. Adding a fourth consumer means changing and redeploying Orders. If Email is down, checkout fails.'],
        { metrics: { Coupling: 'high' }, bad: ['Coupling'] },
        { entities: { p: E('server', -5, 0, 'Orders svc'), e: E('worker', 3, -3.7, 'Email', { state: 'down' }), i: E('worker', 3, 0, 'Inventory'), a: E('worker', 3, 3.7, 'Analytics') }, links: { b: L('p', 'e', { style: 'broken' }), c: L('p', 'i'), d: L('p', 'a') }, flows: [{ route: ['p', ['e', 'i', 'a']], pick: 'rr', blind: true, bounce: true, rate: 2 }] }),
      st('Topics', 'concept', 'Publish to a topic', ['Orders publishes an <b>order.placed</b> event to a topic and moves on. Every subscriber gets its own copy and processes it independently.'],
        { metrics: { Coupling: 'low', Subscribers: '3' }, good: ['Coupling'], changes: ['+ Topic'] },
        { entities: pubsub(), links: psLinks, flows: [{ route: ['p', 't'], kind: 'msg', rate: 1.2 }, { route: ['t', 'e'], kind: 'msg', rate: 1.2 }, { route: ['t', 'i'], kind: 'msg', rate: 1.2 }, { route: ['t', 'a'], kind: 'msg', rate: 1.2 }] }),
      st('Fan-out', 'technique', 'Add consumers without touching producers', ['Need fraud checks? Subscribe a new service. Orders never knows. Logs like Kafka also keep events so new consumers can replay history.'],
        { metrics: { Subscribers: '4' }, callout: { kind: 'tip', text: 'Events describe facts in past tense: order.placed, not send.email.' } },
        { entities: { ...pubsub(), f: E('worker', 5, 7.4, 'Fraud', tags(T('new', 'green'))) }, links: { ...psLinks, f: L('t', 'f') }, flows: [{ route: ['p', 't'], kind: 'msg', rate: 1.2 }, { route: ['t', ['e', 'i', 'a', 'f']], pick: 'rr', kind: 'msg', rate: 4.8 }] }),
      st('Recap', 'recap', 'Events decouple teams', recap(['Queues: one consumer per message. Topics: every subscriber gets it.', 'Producers don’t know consumers.', 'Expect duplicates and out-of-order delivery.']), { callout: nextUp('Real-time Updates'), metrics: {} },
        { entities: pubsub(), links: psLinks, flows: [{ route: ['p', 't'], kind: 'msg', rate: 1 }, { route: ['t', ['e', 'i', 'a']], pick: 'rr', kind: 'msg', rate: 3 }] }),
    ],
  };

  R['realtime'] = {
    subtitle: 'Polling, long polling, SSE and WebSockets — pushing updates to clients.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Networking', 'mint']], legend: ['req', 'res', 'msg'],
    steps: [
      st('Polling', 'problem', 'Are we there yet?', ['The client asks “anything new?” every 2 seconds. Most answers are empty, yet each costs a full request. With 1M clients that’s 500k req/s of nothing.'],
        { metrics: { 'Empty replies': '95%' }, bad: ['Empty replies'] },
        { entities: { c: E('client', -5, 0, 'Client'), s: E('server', 3, 0, 'Server') }, links: { l: L('c', 's') }, flows: [{ route: ['c', 's'], bounce: true, rate: 3 }] }),
      st('Long poll', 'technique', 'Long polling: hold the request', ['The server holds the request open until there’s news (or a timeout), then the client immediately asks again. Fewer empty replies, but still one request per event.'],
        { metrics: { 'Empty replies': '10%' } },
        { entities: { c: E('client', -5, 0, 'Client'), s: E('server', 3, 0, 'Server', tags(T('holding…', 'amber'))) }, links: { l: L('c', 's') }, flows: [{ route: ['c', 's'], bounce: true, rate: 0.6, delay: { s: 1.2 } }] }),
      st('WebSocket', 'concept', 'WebSockets: one open pipe', ['A <span class="term">WebSocket</span> upgrades one HTTP connection into a two-way channel that stays open. The server pushes messages the instant they happen. <b>SSE</b> is a simpler one-way version.'],
        { metrics: { Latency: '~instant', Overhead: 'tiny' }, good: ['Latency'] },
        { entities: { c: E('client', -5, 0, 'Client'), s: E('server', 3, 0, 'Server', tags(T('ws open', 'green'))) }, links: { l: L('c', 's', { label: 'persistent' }) }, flows: [{ route: ['s', 'c'], kind: 'msg', rate: 2 }, { route: ['c', 's'], rate: 0.5 }] }),
      st('Recap', 'recap', 'Push when it matters', recap(['Polling: simple, wasteful.', 'Long polling: works everywhere.', 'SSE: server → client streams.', 'WebSockets: two-way; needs sticky connections & a pub/sub backbone to scale.']), { callout: nextUp('Redundancy & Failover'), metrics: {} },
        { entities: { c: E('client', -5, 0, 'Client'), s: E('server', 3, 0, 'Server') }, links: { l: L('c', 's') }, flows: [{ route: ['s', 'c'], kind: 'msg', rate: 2 }] }),
    ],
  };

  // ======================= RELIABILITY =======================
  R['redundancy'] = {
    subtitle: 'Remove single points of failure so one crash isn’t an outage.',
    tags: [['Intermediate', 'violet'], ['~6 min', 'sand'], ['Reliability', 'mint']], legend: ['req', 'res', 'err'],
    steps: [
      st('SPOF', 'problem', 'One of anything is a risk', ['One load balancer, one database. If either dies, the whole site is down. Each is a <span class="term">single point of failure</span>.'],
        { metrics: { Availability: '99.0%', 'Downtime/yr': '3.6 days' }, bad: ['Availability'] },
        { entities: { users: users(), lb: E('lb', -2, 0, 'Load balancer', { state: 'down' }), s: E('server', 2.5, 0, 'App'), db: E('db', 6.5, 0, 'Database') }, links: { a: L('users', 'lb', { style: 'broken' }), b: L('lb', 's'), c: L('s', 'db') }, flows: [{ route: ['users', 'lb'], rate: 3 }] }),
      st('Active-passive', 'technique', 'A standby takes over', ['Run a <b>standby</b> that watches the primary via heartbeats. When the primary stops responding, the standby takes over its address. Failover takes seconds.'],
        { metrics: { Failover: '~10 s', Availability: '99.95%' }, good: ['Availability'] },
        { entities: { users: users(), lb: E('lb', -2, -2, 'LB primary', { state: 'down' }), lb2: E('lb', -2, 2.5, 'LB standby', tags(T('now active', 'green'))), s: E('server', 3, 0, 'App') }, links: { a: L('users', 'lb', { style: 'broken' }), a2: L('users', 'lb2'), b: L('lb2', 's'), h: L('lb', 'lb2', { style: 'off', label: 'heartbeat' }) }, flows: [{ route: ['users', 'lb2', 's'], bounce: true, rate: 3 }] }),
      st('Multi-AZ', 'technique', 'Spread across zones', ['Put copies in separate availability zones (different buildings, power, network). A whole data center can fail and traffic shifts to the others.'],
        { metrics: { Zones: '3', Availability: '99.99%' }, good: ['Availability'], callout: { kind: 'insight', text: 'Each extra nine cuts allowed downtime by 10×: 99.99% ≈ 52 min/year.' } },
        { entities: { users: users(), lb: E('lb', -2, 0, 'Load balancer'), a: E('server', 3, -3.7, 'Zone A'), b: E('server', 3, 0, 'Zone B', { state: 'down' }), c: E('server', 3, 3.7, 'Zone C') }, links: { u: L('users', 'lb'), la: L('lb', 'a'), lb_: L('lb', 'b', { style: 'off' }), lc: L('lb', 'c') }, flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 4 }] }),
      st('Recap', 'recap', 'Two of everything', recap(['Find every SPOF: LB, DB, DNS, region.', 'Active-passive or active-active.', 'Test failover regularly — untested backups don’t exist.']), { callout: nextUp('Rate Limiting'), metrics: { Availability: '99.99%' } },
        { entities: { users: users(), lb: E('lb', -2, 0, 'Load balancer'), a: E('server', 3, -3.7, 'Zone A'), b: E('server', 3, 0, 'Zone B'), c: E('server', 3, 3.7, 'Zone C') }, links: { u: L('users', 'lb'), la: L('lb', 'a'), lb_: L('lb', 'b'), lc: L('lb', 'c') }, flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 4 }] }),
    ],
  };

  R['timeouts-retries'] = {
    subtitle: 'Don’t wait forever, retry carefully, and stop calling what’s broken.',
    tags: [['Intermediate', 'violet'], ['~6 min', 'sand'], ['Reliability', 'mint']], legend: ['req', 'res', 'err'],
    steps: [
      st('Hanging', 'problem', 'A slow dependency freezes you', ['The payments service hangs. Without a timeout, every checkout thread waits forever; soon all threads are stuck and your whole API stops — a <b>cascading failure</b>.'],
        { metrics: { 'Threads stuck': '200/200' }, bad: ['Threads stuck'] },
        { entities: { users: users(), api: E('server', -1, 0, 'API', tags(T('all threads busy', 'red'))), pay: E('server', 5, 0, 'Payments', tags(T('hanging', 'red'))) }, links: { a: L('users', 'api'), b: L('api', 'pay') }, flows: [{ route: ['users', 'api', 'pay'], bounce: true, rate: 3, delay: { pay: 3 } }] }),
      st('Timeouts', 'technique', 'Timeouts + backoff retries', ['Give every call a timeout (e.g. 1 s). Retry transient failures with <b>exponential backoff and jitter</b> — 100 ms, 200 ms, 400 ms… randomised so clients don’t retry in lockstep.'],
        { metrics: { Timeout: '1 s', Retries: '3 max' }, callout: { kind: 'warn', text: 'Only retry idempotent operations, or use idempotency keys.' } },
        { entities: { users: users(), api: E('server', -1, 0, 'API', tags(T('timeout 1s', 'amber'))), pay: E('server', 5, 0, 'Payments') }, links: { a: L('users', 'api'), b: L('api', 'pay') }, flows: [{ route: ['users', 'api', 'pay'], bounce: true, rate: 3, drop: { at: 'pay', p: 0.3 } }] }),
      st('Breaker', 'technique', 'Circuit breaker: stop hammering', ['After many failures the <span class="term">circuit breaker</span> “opens”: calls fail fast without touching payments, giving it time to recover. Periodically it lets one trial request through.'],
        { metrics: { Breaker: 'OPEN', 'API latency': '5 ms' }, good: ['API latency'] },
        { entities: { users: users(), api: E('server', -1, 0, 'API', tags(T('breaker open', 'red'))), pay: E('server', 5, 0, 'Payments', tags(T('recovering', 'amber'))) }, links: { a: L('users', 'api'), b: L('api', 'pay', { style: 'off' }) }, flows: [{ route: ['users', 'api'], bounce: true, backKind: 'err', rate: 3 }] }),
      st('Recap', 'recap', 'Fail fast, recover gracefully', recap(['Timeouts on every network call.', 'Retries with backoff + jitter, capped.', 'Circuit breakers stop cascades.', 'Fallbacks: cached data or a friendly message.']), { callout: nextUp('Observability'), metrics: {} },
        { entities: { users: users(), api: E('server', -1, 0, 'API'), pay: E('server', 5, 0, 'Payments') }, links: { a: L('users', 'api'), b: L('api', 'pay') }, flows: [{ route: ['users', 'api', 'pay'], bounce: true, rate: 3 }] }),
    ],
  };

  R['observability'] = {
    subtitle: 'Logs, metrics and traces: knowing what your system is doing.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Operations', 'mint']], legend: ['req', 'res', 'msg'],
    steps: [
      st('Blind', 'problem', '“The site is slow.” Where?', ['A request crosses 6 services. Users complain, but nobody can tell which service is slow or why.'],
        { metrics: { 'Time to find': 'hours' }, bad: ['Time to find'] },
        { entities: { users: users(), a: E('server', -1, 0, 'Gateway'), b: E('server', 3, -3, 'Orders'), c: E('server', 3, 3, 'Users'), d: E('db', 7, 0, 'DB', tags(T('?', 'amber'))) }, links: { a: L('users', 'a'), b: L('a', 'b'), c: L('a', 'c'), d: L('b', 'd') }, flows: [{ route: ['users', 'a', 'b', 'd'], bounce: true, rate: 2 }] }),
      st('Three pillars', 'concept', 'Logs, metrics, traces', ['<b>Metrics</b>: numbers over time (req/s, errors, p99). <b>Logs</b>: detailed events. <b>Traces</b>: one request’s path across services with timing per hop.'],
        { metrics: { Metrics: 'Prometheus', Logs: 'ELK', Traces: 'OpenTelemetry' } },
        { entities: { a: E('server', -5, -3, 'Orders'), b: E('server', -5, 3, 'Users'), m: E('store', 3, 0, 'Telemetry', tags(T('metrics · logs · traces', 'violet'))) }, links: { a: L('a', 'm', { style: 'dashed' }), b: L('b', 'm', { style: 'dashed' }) }, flows: [{ route: [['a', 'b'], 'm'], pick: 'rr', kind: 'msg', rate: 4 }] }),
      st('Alerts', 'technique', 'Alert on symptoms', ['Define <b>SLOs</b> (e.g. 99.9% of requests under 300 ms). Page humans when users are hurting — high error rate or latency — not for every CPU blip.'],
        { metrics: { SLO: '99.9% < 300 ms', Burn: '4×' }, bad: ['Burn'], callout: { kind: 'tip', text: 'Track the four golden signals: latency, traffic, errors, saturation.' } },
        { entities: { m: E('store', -3, 0, 'Telemetry'), al: E('box', 3, 0, 'Alerting', tags(T('error rate 3%', 'red'))) }, links: { a: L('m', 'al') }, flows: [{ route: ['m', 'al'], kind: 'err', rate: 1 }] }),
      st('Recap', 'recap', 'You can’t fix what you can’t see', recap(['Metrics for trends, logs for detail, traces for paths.', 'Propagate a trace ID through every call.', 'Alert on SLOs and user-facing symptoms.']), { callout: nextUp('Monolith vs Microservices'), metrics: {} },
        { entities: { a: E('server', -5, -3, 'Orders'), b: E('server', -5, 3, 'Users'), m: E('store', 3, 0, 'Telemetry') }, links: { a: L('a', 'm', { style: 'dashed' }), b: L('b', 'm', { style: 'dashed' }) }, flows: [{ route: [['a', 'b'], 'm'], pick: 'rr', kind: 'msg', rate: 3 }] }),
    ],
  };

  // ======================= ARCHITECTURE =======================
  R['microservices'] = {
    subtitle: 'One deployable app, or many small services? Trade-offs, not fashion.',
    tags: [['Intermediate', 'violet'], ['~6 min', 'sand'], ['Architecture', 'mint']], legend: ['req', 'res'],
    steps: [
      st('Monolith', 'concept', 'The monolith', ['All features in one codebase, one deploy, one database. Simple to build, test and run. Most successful products started here.'],
        { metrics: { Deploys: '1 app', Teams: '1–3' } },
        { entities: { users: users(), m: E('big', 1, 0, 'Monolith', { sub: 'users · orders · billing' }), db: E('db', 6, 0, 'DB') }, links: { a: L('users', 'm'), b: L('m', 'db') }, flows: [{ route: ['users', 'm', 'db'], bounce: true, rate: 3 }] }),
      st('Growing pains', 'problem', '200 engineers, one codebase', ['Every deploy ships everyone’s changes; one bug blocks all teams. You can’t scale the busy search feature without scaling everything.'],
        { metrics: { 'Deploys/day': '1', 'Build time': '45 min' }, bad: ['Build time'] },
        { entities: { users: users(), m: E('big', 1, 0, 'Monolith', tags(T('merge conflicts', 'red'))), db: E('db', 6, 0, 'DB') }, links: { a: L('users', 'm'), b: L('m', 'db') }, flows: [{ route: ['users', 'm', 'db'], bounce: true, rate: 5, delay: { m: 0.3 } }] }),
      st('Services', 'technique', 'Split by business capability', ['Each <span class="term">microservice</span> owns one capability and its own data, and deploys independently. Teams move in parallel — at the cost of network calls, distributed data and more ops.'],
        { metrics: { 'Deploys/day': '50+', Services: '3' }, good: ['Deploys/day'], callout: { kind: 'warn', text: 'Microservices trade code complexity for operational complexity.' } },
        { entities: { users: users(), g: E('lb', -2, 0, 'Gateway'), u: E('server', 2.5, -3.7, 'Users'), o: E('server', 2.5, 0, 'Orders'), b: E('server', 2.5, 3.7, 'Billing'), du: E('db', 6.5, -3.7, ''), do_: E('db', 6.5, 0, ''), db: E('db', 6.5, 3.7, '') }, links: { a: L('users', 'g'), b: L('g', 'u'), c: L('g', 'o'), d: L('g', 'b'), e: L('u', 'du'), f: L('o', 'do_'), h: L('b', 'db') }, flows: [{ route: ['users', 'g', ['u', 'o', 'b']], pick: 'rr', bounce: true, rate: 4 }] }),
      st('Recap', 'recap', 'Start monolith, split on need', recap(['Monolith first; keep modules clean.', 'Split when team or scaling pain is real.', 'Each service owns its data.', 'Invest in CI/CD, observability and service discovery first.']), { callout: nextUp('Service Discovery & Gateways'), metrics: {} },
        { entities: { users: users(), g: E('lb', -2, 0, 'Gateway'), u: E('server', 2.5, -3.7, 'Users'), o: E('server', 2.5, 0, 'Orders'), b: E('server', 2.5, 3.7, 'Billing') }, links: { a: L('users', 'g'), b: L('g', 'u'), c: L('g', 'o'), d: L('g', 'b') }, flows: [{ route: ['users', 'g', ['u', 'o', 'b']], pick: 'rr', bounce: true, rate: 4 }] }),
    ],
  };

  R['service-discovery'] = {
    subtitle: 'How services find each other when addresses change every minute.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Architecture', 'mint']], legend: ['req', 'res', 'msg'],
    steps: [
      st('Moving targets', 'problem', 'Hard-coded IPs break', ['Containers restart and autoscale constantly; their IPs change. A config file listing <code>10.0.3.17</code> is wrong within the hour.'],
        { metrics: { 'Stale addresses': 'many' }, bad: ['Stale addresses'] },
        { entities: { o: E('server', -4, 0, 'Orders'), u: E('server', 3, -2.5, 'Users (old IP)', { state: 'down' }), u2: E('server', 3, 2.5, 'Users (new IP)') }, links: { a: L('o', 'u', { style: 'broken' }), b: L('o', 'u2', { style: 'off' }) }, flows: [{ route: ['o', 'u'], rate: 2 }] }),
      st('Registry', 'concept', 'A service registry', ['Instances register themselves (and send heartbeats) with a <span class="term">registry</span> like Consul or Kubernetes DNS. Callers look up “users” and get healthy addresses.'],
        { metrics: { 'Stale addresses': '0' }, good: ['Stale addresses'] },
        { entities: { o: E('server', -5, 0, 'Orders'), r: E('dns', 0, -4, 'Registry', tags(T('users → 2 IPs', 'green'))), u: E('server', 4, -1.5, 'Users 1'), u2: E('server', 4, 2.5, 'Users 2') }, links: { q: L('o', 'r', { style: 'dashed' }), a: L('o', 'u'), b: L('o', 'u2'), h1: L('u', 'r', { style: 'off' }), h2: L('u2', 'r', { style: 'off' }) }, flows: [{ route: ['o', 'r'], bounce: true, rate: 0.6, size: 4 }, { route: ['o', ['u', 'u2']], pick: 'rr', bounce: true, rate: 3 }, { route: [['u', 'u2'], 'r'], pick: 'rr', kind: 'msg', rate: 1, size: 3.5 }] }),
      st('Gateway', 'technique', 'An API gateway at the edge', ['External clients hit one <span class="term">API gateway</span> that routes <code>/orders</code> and <code>/users</code> to the right service, and handles auth, rate limits and TLS in one place.'],
        { metrics: { 'Public entry points': '1' }, callout: { kind: 'tip', text: 'A service mesh (Istio, Linkerd) does the same for service-to-service traffic.' } },
        { entities: { users: users(), g: E('lb', -2, 0, 'API gateway', tags(T('auth · routing', 'amber'))), o: E('server', 3, -2.5, 'Orders'), u: E('server', 3, 2.5, 'Users') }, links: { a: L('users', 'g'), b: L('g', 'o'), c: L('g', 'u') }, flows: [{ route: ['users', 'g', ['o', 'u']], pick: 'rr', bounce: true, rate: 3 }] }),
      st('Recap', 'recap', 'Names, not addresses', recap(['Registry + health checks track live instances.', 'Client-side or server-side lookup.', 'Gateway for north-south, mesh for east-west traffic.']), { callout: nextUp('Sagas & Distributed Transactions'), metrics: {} },
        { entities: { users: users(), g: E('lb', -2, 0, 'API gateway'), o: E('server', 3, -2.5, 'Orders'), u: E('server', 3, 2.5, 'Users') }, links: { a: L('users', 'g'), b: L('g', 'o'), c: L('g', 'u') }, flows: [{ route: ['users', 'g', ['o', 'u']], pick: 'rr', bounce: true, rate: 3 }] }),
    ],
  };

  const saga = (o = {}) => ({ o: E('server', -6, 0, 'Orders', o.o), p: E('server', -1, -3, 'Payments', o.p), i: E('server', 4, 0, 'Inventory', o.i), s: E('server', -1, 3.5, 'Shipping', o.s) });
  R['sagas'] = {
    subtitle: 'Multi-service workflows that undo themselves when a step fails.',
    tags: [['Advanced', 'violet'], ['~6 min', 'sand'], ['Architecture', 'mint']], legend: ['msg', 'err'],
    steps: [
      st('No global tx', 'problem', 'Each service has its own database', ['Placing an order touches Orders, Payments and Inventory — three databases. There is no single transaction across them; locking all three (2PC) is slow and fragile.'],
        { metrics: { 'Global lock': 'no' } },
        { entities: saga(), links: { a: L('o', 'p'), b: L('p', 'i'), c: L('i', 's') }, flows: [] }),
      st('Saga', 'concept', 'A chain of local steps', ['A <span class="term">saga</span> runs each step as a local transaction and triggers the next via an event: create order → charge card → reserve stock → ship.'],
        { metrics: { Steps: '4' } },
        { entities: saga(), links: { a: L('o', 'p'), b: L('p', 'i'), c: L('i', 's') }, flows: [{ route: ['o', 'p', 'i', 's'], kind: 'msg', rate: 1, speed: 0.7 }] }),
      st('Compensate', 'technique', 'Undo with compensating actions', ['Stock runs out at step 3. The saga runs <b>compensations</b> backwards: refund the card, cancel the order. The system ends consistent — eventually.'],
        { metrics: { Outcome: 'refunded' }, callout: { kind: 'tip', text: 'Orchestration (a central coordinator) is easier to follow than choreography for long sagas.' } },
        { entities: saga({ i: tags(T('out of stock', 'red')), p: tags(T('refund', 'amber')), o: tags(T('cancelled', 'amber')) }), links: { a: L('o', 'p'), b: L('p', 'i'), c: L('i', 's', { style: 'off' }) }, flows: [{ route: ['i', 'p', 'o'], kind: 'err', rate: 1, speed: 0.7 }] }),
      st('Recap', 'recap', 'Forward steps, backward undo', recap(['Sagas replace distributed transactions.', 'Every step needs a compensating action.', 'Steps must be idempotent.', 'Users may briefly see intermediate states.']), { callout: nextUp('Batch & Stream Processing'), metrics: {} },
        { entities: saga(), links: { a: L('o', 'p'), b: L('p', 'i'), c: L('i', 's') }, flows: [{ route: ['o', 'p', 'i', 's'], kind: 'msg', rate: 1 }] }),
    ],
  };

  R['batch-stream'] = {
    subtitle: 'Process data in big nightly chunks, or continuously as it arrives.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Data', 'mint']], legend: ['msg'],
    steps: [
      st('Batch', 'concept', 'Batch: process it all at once', ['Every night a job (Spark, MapReduce) reads the day’s logs from storage, crunches them across many workers and writes reports. High throughput, but results are hours old.'],
        { metrics: { Freshness: '24 h', Throughput: 'huge' } },
        { entities: { s: E('store', -5, 0, 'Data lake'), w1: E('worker', 1, -3.7, 'Worker'), w2: E('worker', 1, 0, 'Worker'), w3: E('worker', 1, 3.7, 'Worker'), r: E('db', 6, 0, 'Reports') }, links: { a: L('s', 'w1'), b: L('s', 'w2'), c: L('s', 'w3'), d: L('w1', 'r'), e: L('w2', 'r'), f: L('w3', 'r') }, flows: [{ route: ['s', ['w1', 'w2', 'w3'], 'r'], pick: 'rr', kind: 'msg', rate: 5 }] }),
      st('Stream', 'concept', 'Stream: process each event', ['A stream processor (Flink, Kafka Streams) consumes events from a log as they happen and updates results continuously — dashboards in seconds, fraud blocked instantly.'],
        { metrics: { Freshness: 'seconds' }, good: ['Freshness'] },
        { entities: { p: E('server', -6, 0, 'Apps'), k: E('queue', -1, 0, 'Event log'), f: E('worker', 4, 0, 'Stream job'), d: E('db', 7.5, 0, 'Live view') }, links: { a: L('p', 'k'), b: L('k', 'f'), c: L('f', 'd') }, flows: [{ route: ['p', 'k', 'f', 'd'], kind: 'msg', rate: 4 }] }),
      st('Windows', 'technique', 'Windows and late data', ['Streams aggregate in <b>windows</b> (“clicks per minute”). Events arrive late or out of order, so processors use event time and watermarks to decide when a window is done.'],
        { metrics: { Window: '1 min' }, callout: { kind: 'insight', text: 'Many teams run both: streaming for fresh, approximate results; batch for complete, corrected ones.' } },
        { entities: { k: E('queue', -3, 0, 'Event log'), f: E('worker', 3, 0, 'Stream job', tags(T('window 12:01', 'amber'))) }, links: { b: L('k', 'f') }, flows: [{ route: ['k', 'f'], kind: 'msg', rate: 5 }] }),
      st('Recap', 'recap', 'Freshness vs completeness', recap(['Batch: big, cheap, slow to update.', 'Stream: fresh, more complex.', 'An event log (Kafka) feeds both.']), { callout: nextUp('Authentication'), metrics: {} },
        { entities: { p: E('server', -6, 0, 'Apps'), k: E('queue', -1, 0, 'Event log'), f: E('worker', 4, 0, 'Stream job') }, links: { a: L('p', 'k'), b: L('k', 'f') }, flows: [{ route: ['p', 'k', 'f'], kind: 'msg', rate: 3 }] }),
    ],
  };

  // ======================= SECURITY =======================
  R['authentication'] = {
    subtitle: 'Proving who you are: passwords, sessions, tokens and SSO.',
    tags: [['Beginner', 'mint'], ['~6 min', 'sand'], ['Security', 'violet']], legend: ['req', 'res', 'err'],
    steps: [
      st('Login', 'concept', 'Checking a password', ['The user sends credentials over HTTPS. The server compares them against a <b>slow, salted hash</b> (bcrypt, argon2) — never the plain password.'],
        { metrics: { Storage: 'argon2 hash' }, callout: { kind: 'warn', text: 'Never store passwords in plain text or with fast hashes like MD5.' } },
        { entities: { c: E('client', -5, 0, 'Browser'), a: E('server', 1, 0, 'Auth svc'), db: E('db', 6, 0, 'Users', tags(T('hashed', 'violet'))) }, links: { a: L('c', 'a', { label: 'HTTPS' }), b: L('a', 'db') }, flows: [{ route: ['c', 'a', 'db'], bounce: true, rate: 1.5 }] }),
      st('Sessions', 'technique', 'Session cookies', ['On success, the server creates a session ID, stores it server-side, and sets it as an <b>HttpOnly, Secure</b> cookie. Each request sends the cookie; the server looks it up.'],
        { metrics: { Revocable: 'yes', Lookup: 'every request' } },
        { entities: { c: E('client', -5, 0, 'Browser', tags(T('cookie: sid=…', 'amber'))), a: E('server', 1, 0, 'API'), r: E('cache', 6, 0, 'Sessions') }, links: { a: L('c', 'a'), b: L('a', 'r') }, flows: [{ route: ['c', 'a', 'r'], bounce: true, rate: 2 }] }),
      st('Tokens', 'technique', 'Signed tokens (JWT)', ['A <span class="term">JWT</span> carries the user’s claims, signed by the auth server. Any service can verify it without a database lookup. Downside: hard to revoke before it expires — keep them short-lived.'],
        { metrics: { Lookup: 'none', Lifetime: '15 min' }, good: ['Lookup'] },
        { entities: { c: E('client', -5, 0, 'App', tags(T('Bearer eyJ…', 'green'))), a: E('server', 2, -2.5, 'Orders'), b: E('server', 2, 2.5, 'Users') }, links: { a: L('c', 'a'), b: L('c', 'b') }, flows: [{ route: ['c', ['a', 'b']], pick: 'rr', bounce: true, rate: 3 }] }),
      st('Recap', 'recap', 'Prove identity safely', recap(['Hash passwords with bcrypt/argon2.', 'Sessions: easy to revoke. JWTs: stateless, short-lived.', 'Add MFA; use OAuth/OIDC for “Sign in with…”.']), { callout: nextUp('Authorization'), metrics: {} },
        { entities: { c: E('client', -5, 0, 'Browser'), a: E('server', 1, 0, 'Auth svc'), db: E('db', 6, 0, 'Users') }, links: { a: L('c', 'a'), b: L('a', 'db') }, flows: [{ route: ['c', 'a', 'db'], bounce: true, rate: 1.5 }] }),
    ],
  };

  R['authorization'] = {
    subtitle: 'Deciding what an authenticated user is allowed to do.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Security', 'mint']], legend: ['req', 'res', 'err'],
    steps: [
      st('IDOR', 'problem', 'Logged in ≠ allowed', ['Alice is logged in and requests <code>/invoices/1043</code> — Bob’s invoice. The API only checked that she’s authenticated, so it returns it.'],
        { metrics: { 'Leak': 'yes' }, bad: ['Leak'] },
        { entities: { c: E('users', -6, 0, 'Alice'), a: E('server', 0, 0, 'API', tags(T('no ownership check', 'red'))), db: E('db', 5, 0, 'Invoices') }, links: { a: L('c', 'a'), b: L('a', 'db') }, flows: [{ route: ['c', 'a', 'db'], bounce: true, rate: 1.5 }] }),
      st('RBAC', 'concept', 'Roles and permissions', ['<span class="term">RBAC</span> grants permissions to roles (admin, editor, viewer) and roles to users. <b>ABAC</b> adds rules on attributes: “owners can edit their own invoices”.'],
        { metrics: { Model: 'RBAC + ownership' } },
        { entities: { c: E('users', -6, 0, 'Alice'), a: E('server', 0, 0, 'API'), p: E('box', 0, -4.5, 'Policy', tags(T('owner == user', 'green'))), db: E('db', 5, 0, 'Invoices') }, links: { a: L('c', 'a'), b: L('a', 'db'), q: L('a', 'p', { style: 'dashed' }) }, flows: [{ route: ['c', 'a'], bounce: true, backKind: 'err', rate: 1.5 }] }),
      st('Least privilege', 'technique', 'Least privilege everywhere', ['Check permissions on <b>every</b> request, server-side. Give services and people only the access they need — a compromised account then does limited damage.'],
        { metrics: { 'Denied (403)': 'correctly' }, good: ['Denied (403)'] },
        { entities: { c: E('users', -6, 0, 'Alice'), a: E('server', 0, 0, 'API', tags(T('403 Forbidden', 'amber'))), db: E('db', 5, 0, 'Invoices') }, links: { a: L('c', 'a'), b: L('a', 'db', { style: 'off' }) }, flows: [{ route: ['c', 'a'], bounce: true, backKind: 'err', rate: 1.5 }] }),
      st('Recap', 'recap', 'Who can do what', recap(['AuthN = who you are; AuthZ = what you may do.', 'Enforce on the server, every request.', 'RBAC for roles, ABAC/ownership for fine grain.', 'Default deny.']), { callout: nextUp('Encryption & Secrets'), metrics: {} },
        { entities: { c: E('users', -6, 0, 'Alice'), a: E('server', 0, 0, 'API'), db: E('db', 5, 0, 'Invoices') }, links: { a: L('c', 'a'), b: L('a', 'db') }, flows: [{ route: ['c', 'a', 'db'], bounce: true, rate: 1.5 }] }),
    ],
  };

  R['encryption'] = {
    subtitle: 'Protect data on the wire and on disk, and keep keys out of code.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Security', 'mint']], legend: ['req', 'res'],
    steps: [
      st('In transit', 'concept', 'TLS on every hop', ['<span class="term">TLS</span> encrypts traffic so nobody on the network can read or alter it. Use it between users and your edge — and between internal services too (mTLS).'],
        { metrics: { 'In transit': 'TLS 1.3' }, good: ['In transit'] },
        { entities: { c: E('client', -5, 0, 'Browser'), lb: E('lb', 0, 0, 'Edge', tags(T('🔒 TLS', 'green'))), s: E('server', 5, 0, 'App', tags(T('mTLS', 'green'))) }, links: { a: L('c', 'lb', { label: 'HTTPS' }), b: L('lb', 's', { label: 'mTLS' }) }, flows: [{ route: ['c', 'lb', 's'], bounce: true, rate: 2 }] }),
      st('At rest', 'concept', 'Encrypt stored data', ['Databases, disks and backups should be encrypted <b>at rest</b>, so a stolen disk or leaked snapshot is useless without the key.'],
        { metrics: { 'At rest': 'AES-256' } },
        { entities: { s: E('server', -4, 0, 'App'), db: E('db', 3, 0, 'Database', tags(T('AES-256', 'violet'))) }, links: { a: L('s', 'db') }, flows: [{ route: ['s', 'db'], bounce: true, rate: 2 }] }),
      st('Secrets', 'technique', 'Secrets don’t belong in code', ['API keys and DB passwords in Git leak eventually. Keep them in a <b>secrets manager</b> (Vault, AWS Secrets Manager), inject at runtime, and rotate regularly.'],
        { metrics: { 'Secrets in Git': '0' }, good: ['Secrets in Git'], callout: { kind: 'tip', text: 'Envelope encryption: data keys encrypt data; a KMS master key encrypts data keys.' } },
        { entities: { v: E('cache', -4, -3, 'Secrets vault'), s: E('server', 1, 0, 'App'), db: E('db', 6, 0, 'Database') }, links: { a: L('v', 's', { style: 'dashed' }), b: L('s', 'db') }, flows: [{ route: ['v', 's'], kind: 'msg', rate: 0.5 }, { route: ['s', 'db'], bounce: true, rate: 2 }] }),
      st('Recap', 'recap', 'Encrypt everywhere', recap(['TLS in transit, including internal traffic.', 'Encryption at rest for data and backups.', 'Secrets in a vault, rotated, never in code.']), { callout: nextUp('Testing'), metrics: {} },
        { entities: { c: E('client', -5, 0, 'Browser'), lb: E('lb', 0, 0, 'Edge'), s: E('server', 5, 0, 'App') }, links: { a: L('c', 'lb'), b: L('lb', 's') }, flows: [{ route: ['c', 'lb', 's'], bounce: true, rate: 2 }] }),
    ],
  };

  // ======================= SHIPPING =======================
  R['testing'] = {
    subtitle: 'Unit, integration, end-to-end and load tests — what each one catches.',
    tags: [['Beginner', 'mint'], ['~5 min', 'sand'], ['Quality', 'violet']], legend: ['req', 'res', 'err'],
    steps: [
      st('Pyramid', 'concept', 'The testing pyramid', ['Many fast <b>unit</b> tests (one function), fewer <b>integration</b> tests (service + DB), and a handful of slow <b>end-to-end</b> tests (real browser through the whole system).'],
        { metrics: { Unit: '2000', Integration: '200', E2E: '20' } },
        { entities: { u: E('worker', -5, 0, 'Unit', tags(T('ms each', 'green'))), i: E('server', 0, 0, 'Integration', tags(T('seconds', 'amber'))), e: E('big', 5.5, 0, 'End-to-end', tags(T('minutes', 'red'))) }, links: { a: L('u', 'i', { style: 'off' }), b: L('i', 'e', { style: 'off' }) }, flows: [] }),
      st('Contracts', 'technique', 'Contract tests between services', ['When Orders calls Users, a <b>contract test</b> checks that Users still returns what Orders expects — catching breaking API changes before deploy.'],
        { metrics: { 'Breaking changes caught': 'pre-deploy' }, good: ['Breaking changes caught'] },
        { entities: { o: E('server', -4, 0, 'Orders'), u: E('server', 3, 0, 'Users', tags(T('contract ✓', 'green'))) }, links: { a: L('o', 'u') }, flows: [{ route: ['o', 'u'], bounce: true, rate: 2 }] }),
      st('Load test', 'technique', 'Load test before launch', ['Simulate peak traffic (k6, Locust) against staging. Find the breaking point and the slowest component <i>before</i> real users do.'],
        { metrics: { 'Breaks at': '8k req/s' }, callout: { kind: 'tip', text: 'Chaos testing goes further: kill servers on purpose to prove failover works.' } },
        { entities: { g: E('users', -6, 0, 'Load gen', tags(T('ramping 8k/s', 'amber'))), s: E('server', 1, 0, 'Staging', tags(T('p99 rising', 'red'))), db: E('db', 6, 0, 'DB') }, links: { a: L('g', 's'), b: L('s', 'db') }, flows: [{ route: ['g', 's', 'db'], bounce: true, rate: 8, drop: { at: 's', p: 0.1 } }] }),
      st('Recap', 'recap', 'Test at every level', recap(['Lots of unit tests, fewer integration, few E2E.', 'Contract tests protect service boundaries.', 'Load and chaos tests reveal scale and failure behaviour.']), { callout: nextUp('CI/CD & Deployments'), metrics: {} },
        { entities: { o: E('server', -4, 0, 'Orders'), u: E('server', 3, 0, 'Users') }, links: { a: L('o', 'u') }, flows: [{ route: ['o', 'u'], bounce: true, rate: 2 }] }),
    ],
  };

  R['cicd'] = {
    subtitle: 'Ship small changes safely, many times a day.',
    tags: [['Beginner', 'mint'], ['~6 min', 'sand'], ['DevOps', 'violet']], legend: ['req', 'res', 'msg'],
    steps: [
      st('Pipeline', 'concept', 'From commit to production', ['Every push triggers a <span class="term">CI</span> pipeline: build, run tests, scan, package an image. <span class="term">CD</span> then deploys that exact image to staging and production.'],
        { metrics: { 'Commit → prod': '15 min' } },
        { entities: { g: E('box', -7, 0, 'Git push'), ci: E('worker', -2.5, 0, 'Build + test'), reg: E('store', 2, 0, 'Image registry'), p: E('server', 6.5, 0, 'Production') }, links: { a: L('g', 'ci'), b: L('ci', 'reg'), c: L('reg', 'p') }, flows: [{ route: ['g', 'ci', 'reg', 'p'], kind: 'msg', rate: 1, speed: 0.7 }] }),
      st('Rolling', 'technique', 'Rolling deploys', ['Replace servers a few at a time; the load balancer drains each one first. No downtime, and you can stop if errors rise.'],
        { metrics: { Updated: '1 / 3', Downtime: '0' }, good: ['Downtime'] },
        { entities: { users: users(), lb: E('lb', -2.2, 0, 'Load balancer'), a: E('server', 2.5, -3.7, 'v2', tags(T('new', 'green'))), b: E('server', 2.5, 0, 'v1'), c: E('server', 2.5, 3.7, 'v1') }, links: { u: L('users', 'lb'), la: L('lb', 'a'), lb_: L('lb', 'b'), lc: L('lb', 'c') }, flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 4 }] }),
      st('Canary', 'technique', 'Canary and blue-green', ['A <b>canary</b> sends 5% of traffic to the new version and watches metrics before going wider. <b>Blue-green</b> runs two full environments and flips traffic at once — instant rollback.'],
        { metrics: { Canary: '5%' }, callout: { kind: 'tip', text: 'Feature flags let you deploy code dark and turn it on separately.' } },
        { entities: { users: users(), lb: E('lb', -2, 0, 'Router', tags(T('95 / 5', 'amber'))), b: E('server', 3, -2.5, 'Stable v1'), g: E('server', 3, 2.5, 'Canary v2', tags(T('watching errors', 'green'))) }, links: { u: L('users', 'lb'), a: L('lb', 'b'), c: L('lb', 'g') }, flows: [{ route: ['users', 'lb', ['b', 'g']], pick: 'weighted', weights: { b: 9, g: 1 }, bounce: true, rate: 5 }] }),
      st('Recap', 'recap', 'Small, frequent, reversible', recap(['Automate build → test → deploy.', 'Deploy the same artifact everywhere.', 'Rolling, canary or blue-green to limit blast radius.', 'Make rollback one click.']), { callout: nextUp('HLD & LLD'), metrics: {} },
        { entities: { g: E('box', -7, 0, 'Git push'), ci: E('worker', -2.5, 0, 'Build + test'), reg: E('store', 2, 0, 'Registry'), p: E('server', 6.5, 0, 'Production') }, links: { a: L('g', 'ci'), b: L('ci', 'reg'), c: L('reg', 'p') }, flows: [{ route: ['g', 'ci', 'reg', 'p'], kind: 'msg', rate: 1 }] }),
    ],
  };

  // ======================= WHOLE SYSTEMS =======================
  R['hld-lld'] = {
    subtitle: 'Boxes-and-arrows architecture vs classes, APIs and schemas.',
    tags: [['Beginner', 'mint'], ['~5 min', 'sand'], ['Interviews', 'violet']], legend: ['req', 'res'],
    steps: [
      st('Requirements', 'concept', 'Start with requirements', ['Before drawing anything, pin down <b>functional</b> needs (what it does) and <b>non-functional</b> ones (scale, latency, availability). Then estimate load with napkin math.'],
        { metrics: { DAU: '?', 'Read:write': '?', 'Latency goal': '?' } },
        { entities: { users: users(), s: E('box', 3, 0, 'System?', tags(T('requirements first', 'amber'))) }, links: { l: L('users', 's', { style: 'dashed' }) }, flows: [] }),
      st('HLD', 'concept', 'High-level design', ['<span class="term">HLD</span> shows the major components and how data flows: clients, gateway, services, caches, databases, queues. It answers “how does this scale and fail?”'],
        { metrics: { Components: '6' } },
        { entities: { users: users(), g: E('lb', -2.5, 0, 'Gateway'), s: E('server', 1.5, 0, 'Service'), c: E('cache', 5, -3.5, 'Cache'), db: E('db', 5.5, 2, 'DB'), q: E('queue', 1, 4.5, 'Queue') }, links: { a: L('users', 'g'), b: L('g', 's'), c: L('s', 'c'), d: L('s', 'db'), e: L('s', 'q') }, flows: [{ route: ['users', 'g', 's', ['c', 'db']], pick: 'rr', bounce: true, rate: 3 }] }),
      st('LLD', 'concept', 'Low-level design', ['<span class="term">LLD</span> zooms into one component: API endpoints, data schemas, class structure, algorithms, error handling.'],
        { metrics: { 'API': 'POST /orders', Schema: 'orders(id, user_id, …)' } },
        { entities: { s: E('server', -3, 0, 'Order service', tags(T('POST /orders', 'blue'))), db: E('db', 3, 0, 'orders table', tags(T('id · user_id · total', 'violet'))) }, links: { a: L('s', 'db') }, flows: [{ route: ['s', 'db'], bounce: true, rate: 2 }] }),
      st('Recap', 'recap', 'Zoom out, then in', recap(['Clarify requirements and estimate.', 'HLD: components, data flow, bottlenecks.', 'LLD: APIs, schemas, classes.', 'Discuss trade-offs out loud.']), { callout: nextUp('Design a URL Shortener'), metrics: {} },
        { entities: { users: users(), g: E('lb', -2.5, 0, 'Gateway'), s: E('server', 1.5, 0, 'Service'), db: E('db', 5.5, 0, 'DB') }, links: { a: L('users', 'g'), b: L('g', 's'), d: L('s', 'db') }, flows: [{ route: ['users', 'g', 's', 'db'], bounce: true, rate: 3 }] }),
    ],
  };

  const short = (o = {}) => ({ users: users(), lb: E('lb', -2.5, 0, 'Load balancer'), s: E('server', 1.5, 0, 'Shortener'), c: E('cache', 5.5, -3.5, 'Cache', o.c), db: E('db', 6, 2, 'URL store', o.db), ...(o.extra || {}) });
  R['design-url-shortener'] = {
    subtitle: 'Turn long links into short codes — and redirect billions of clicks.',
    tags: [['Intermediate', 'violet'], ['~8 min', 'sand'], ['Case study', 'mint']], legend: ['req', 'res', 'hit'],
    steps: [
      st('Requirements', 'concept', 'What are we building?', ['Create short links; redirect fast. Assume 100M new links/month and <b>100:1</b> reads to writes → ~4k redirects/s average, 40 writes/s.', 'Over 10 years: 12B links × 500 B ≈ <b>6 TB</b>.'],
        { metrics: { Writes: '40/s', Reads: '4k/s', Storage: '6 TB' } },
        { entities: { users: users(), s: E('server', 2, 0, 'Shortener', tags(T('sho.rt/aZ3k9', 'green'))) }, links: { l: L('users', 's') }, flows: [{ route: ['users', 's'], bounce: true, rate: 3 }] }),
      st('Short codes', 'technique', 'Generating the code', ['7 characters of base62 gives 62⁷ ≈ <b>3.5 trillion</b> codes. Take a unique ID (counter or Snowflake) and base62-encode it — no collisions to check.'],
        { metrics: { Alphabet: 'base62', Length: '7', Space: '3.5T' }, callout: { kind: 'tip', text: 'Hashing the URL also works, but needs collision handling.' } },
        { entities: short({ extra: { id: E('worker', 1.5, -4.5, 'ID generator') } }), links: { a: L('users', 'lb'), b: L('lb', 's'), d: L('s', 'db'), i: L('s', 'id', { style: 'dashed' }) }, flows: [{ route: ['users', 'lb', 's', 'db'], bounce: true, rate: 1 }, { route: ['s', 'id'], bounce: true, rate: 1, size: 4 }] }),
      st('Redirects', 'technique', 'Cache the hot links', ['Redirects dominate. A cache in front of the store serves popular codes in ~1 ms; respond with <b>301</b> (cacheable by browsers) or <b>302</b> (if you need click analytics).'],
        { metrics: { 'Hit rate': '90%', p95: '5 ms' }, good: ['Hit rate', 'p95'] },
        { entities: short({ c: tags(T('hit 90%', 'green')) }), links: { a: L('users', 'lb'), b: L('lb', 's'), c: L('s', 'c'), d: L('s', 'db') }, flows: [{ route: ['users', 'lb', 's', 'c'], hit: { at: 'c', p: 1 }, rate: 4 }, { route: ['users', 'lb', 's', 'db'], bounce: true, rate: 0.5 }] }),
      st('Recap', 'recap', 'Simple, read-heavy, cacheable', recap(['Unique ID → base62 code.', 'Key-value store, sharded by code.', 'Cache + CDN for hot redirects.', 'Analytics via an async queue, off the hot path.']), { callout: nextUp('Design a News Feed'), metrics: {} },
        { entities: short(), links: { a: L('users', 'lb'), b: L('lb', 's'), c: L('s', 'c'), d: L('s', 'db') }, flows: [{ route: ['users', 'lb', 's', 'c'], hit: { at: 'c', p: 0.9 }, bounce: true, rate: 4 }] }),
    ],
  };

  R['design-news-feed'] = {
    subtitle: 'Show each user the latest posts from everyone they follow.',
    tags: [['Advanced', 'violet'], ['~8 min', 'sand'], ['Case study', 'mint']], legend: ['req', 'res', 'msg', 'hit'],
    steps: [
      st('Pull', 'problem', 'Fan-out on read', ['When Alice opens her feed, query the latest posts of all 500 people she follows and merge them. Simple writes, but every feed load is a huge, slow query.'],
        { metrics: { 'Feed load': '800 ms' }, bad: ['Feed load'] },
        { entities: { u: E('users', -6, 0, 'Alice'), f: E('server', -1, 0, 'Feed svc'), db: E('db', 5, 0, 'Posts', tags(T('500 lookups', 'red'))) }, links: { a: L('u', 'f'), b: L('f', 'db') }, flows: [{ route: ['u', 'f', 'db'], bounce: true, rate: 2, delay: { db: 0.8 } }] }),
      st('Push', 'technique', 'Fan-out on write', ['When Bob posts, push the post ID into each follower’s pre-built feed list in a cache. Reading a feed becomes one fast lookup.'],
        { metrics: { 'Feed load': '10 ms' }, good: ['Feed load'], changes: ['+ Fan-out workers', '+ Feed cache per user'] },
        { entities: { b: E('client', -7, -3, 'Bob posts'), q: E('queue', -2, -3, 'Fan-out'), w: E('worker', 3, -3, 'Workers'), fc: E('cache', 3, 2, 'Feed cache'), u: E('users', -6, 3, 'Alice') }, links: { a: L('b', 'q'), c: L('q', 'w'), d: L('w', 'fc'), e: L('u', 'fc') }, flows: [{ route: ['b', 'q', 'w', 'fc'], kind: 'msg', rate: 1.5 }, { route: ['u', 'fc'], hit: { at: 'fc', p: 1 }, rate: 2 }] }),
      st('Celebrities', 'technique', 'Hybrid for celebrities', ['Pushing a post to 50M followers is too slow. Push for normal users; for celebrities, <b>pull</b> their recent posts at read time and merge.'],
        { metrics: { Strategy: 'hybrid' }, callout: { kind: 'insight', text: 'Ranking (ML scoring) usually runs on top of the merged candidate list.' } },
        { entities: { u: E('users', -6, 0, 'Alice'), f: E('server', -1, 0, 'Feed svc', tags(T('merge', 'amber'))), fc: E('cache', 4, -3, 'Feed cache'), cel: E('db', 4, 3, 'Celebrity posts') }, links: { a: L('u', 'f'), b: L('f', 'fc'), c: L('f', 'cel') }, flows: [{ route: ['u', 'f', ['fc', 'cel']], pick: 'rr', bounce: true, rate: 3 }] }),
      st('Recap', 'recap', 'Precompute what you read', recap(['Pull: cheap writes, slow reads.', 'Push: fast reads, expensive writes.', 'Hybrid handles celebrities.', 'Store post IDs in feeds; hydrate from a post cache.']), { callout: nextUp('Design a Chat System'), metrics: {} },
        { entities: { u: E('users', -6, 0, 'Alice'), f: E('server', -1, 0, 'Feed svc'), fc: E('cache', 4, 0, 'Feed cache') }, links: { a: L('u', 'f'), b: L('f', 'fc') }, flows: [{ route: ['u', 'f', 'fc'], bounce: true, rate: 3 }] }),
    ],
  };

  R['design-chat'] = {
    subtitle: 'Deliver messages instantly, in order, to people on many devices.',
    tags: [['Advanced', 'violet'], ['~8 min', 'sand'], ['Case study', 'mint']], legend: ['msg', 'res'],
    steps: [
      st('Connections', 'concept', 'Keep a socket open', ['Each online user holds a <b>WebSocket</b> to a chat server. 10M concurrent users at ~50k connections per server ≈ <b>200 servers</b>.'],
        { metrics: { Online: '10M', 'Per server': '50k', Servers: '200' } },
        { entities: { a: E('client', -6, -3, 'Alice'), b: E('client', -6, 3, 'Bob'), s1: E('server', 1, -3, 'Chat server 1'), s2: E('server', 1, 3, 'Chat server 2') }, links: { a: L('a', 's1', { label: 'ws' }), b: L('b', 's2', { label: 'ws' }) }, flows: [{ route: ['s1', 'a'], kind: 'msg', rate: 0.5 }, { route: ['s2', 'b'], kind: 'msg', rate: 0.5 }] }),
      st('Routing', 'technique', 'Route between servers', ['Alice is on server 1, Bob on server 2. A <b>presence/session store</b> says where Bob is connected; server 1 forwards the message via a pub/sub channel to server 2, which pushes it to Bob.'],
        { metrics: { Delivery: '< 100 ms' }, good: ['Delivery'] },
        { entities: { a: E('client', -7, -3, 'Alice'), b: E('client', -7, 3, 'Bob'), s1: E('server', -1, -3, 'Chat 1'), s2: E('server', -1, 3, 'Chat 2'), ps: E('queue', 5, 0, 'Pub/Sub'), pr: E('cache', 5, -4.5, 'Presence', tags(T('Bob → chat 2', 'green'))) }, links: { a: L('a', 's1'), b: L('b', 's2'), c: L('s1', 'ps'), d: L('ps', 's2'), e: L('s1', 'pr', { style: 'dashed' }) }, flows: [{ route: ['a', 's1', 'ps', 's2', 'b'], kind: 'msg', rate: 1, speed: 0.8 }] }),
      st('Storage', 'technique', 'Store and sync history', ['Messages are written to a wide-column store (Cassandra) keyed by conversation and ordered by a time-sortable ID. Offline users sync missed messages on reconnect; push notifications wake their phones.'],
        { metrics: { Store: 'Cassandra', Ordering: 'per chat' }, callout: { kind: 'tip', text: 'Ordering is guaranteed per conversation, not globally — that’s enough and far cheaper.' } },
        { entities: { a: E('client', -6, 0, 'Alice'), s1: E('server', -1, 0, 'Chat svc'), db: E('db', 4, -2.5, 'Messages'), pn: E('box', 4, 3, 'Push notify') }, links: { a: L('a', 's1'), b: L('s1', 'db'), c: L('s1', 'pn', { style: 'dashed' }) }, flows: [{ route: ['a', 's1', ['db', 'pn']], pick: 'rr', kind: 'msg', rate: 2 }] }),
      st('Recap', 'recap', 'Real-time at scale', recap(['WebSockets for live delivery.', 'Presence store + pub/sub to route across servers.', 'Durable, per-conversation ordered storage.', 'Push notifications and sync for offline users.']), { callout: { kind: 'next', text: 'You’ve finished the course! Try <b>Practice</b> or the <b>Design Lab</b>.' }, metrics: {} },
        { entities: { a: E('client', -7, -3, 'Alice'), b: E('client', -7, 3, 'Bob'), s1: E('server', -1, -3, 'Chat 1'), s2: E('server', -1, 3, 'Chat 2'), ps: E('queue', 5, 0, 'Pub/Sub') }, links: { a: L('a', 's1'), b: L('b', 's2'), c: L('s1', 'ps'), d: L('ps', 's2') }, flows: [{ route: ['a', 's1', 'ps', 's2', 'b'], kind: 'msg', rate: 1 }] }),
    ],
  };

  window.EXTRA_LESSONS = R;
})();
