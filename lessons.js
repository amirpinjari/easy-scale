/* Course content. Each lesson is a list of steps; each step has text for the
   rail and a `scene` the engine renders: entities, links and flows. */
(function () {
  // ---- tiny scene helpers ----
  const E = (kind, x, y, label, extra = {}) => ({ kind, x, y, label, ...extra });
  const L = (from, to, extra = {}) => ({ from, to, ...extra });
  const users = (extra) => E('users', -7, 0, 'Users', extra);
  const srv = (n, y, extra) => E('server', 2.5, y, `Server ${n}`, extra);
  const pool3 = (o = {}) => ({ a: srv('A', -3.7, o.a), b: srv('B', 0, o.b), c: srv('C', 3.7, o.c) });
  const poolLinks = (from = 'lb') => ({ la: L(from, 'a'), lb_: L(from, 'b'), lc: L(from, 'c') });

  const CHAPTERS = [
    { id: 'foundations', title: 'Foundations', tone: 'var(--orange)', lessons: [
      ['request-lifecycle', 'How a Request Travels'], ['latency-throughput', 'Latency & Throughput'], ['napkin-math', 'Napkin Math']] },
    { id: 'scaling', title: 'Scaling', tone: 'var(--green)', lessons: [
      ['vertical-horizontal', 'Vertical vs Horizontal'], ['load-balancing', 'Load Balancing'], ['stateless', 'Stateless Services'], ['caching', 'Caching'], ['cdn', 'Content Delivery']] },
    { id: 'data', title: 'Data & Storage', tone: 'var(--violet)', lessons: [
      ['sql-nosql', 'SQL vs NoSQL'], ['indexes', 'Indexes'], ['storage-engines', 'Storage Engines'], ['replication', 'Replication'], ['sharding', 'Sharding'], ['consistent-hashing', 'Consistent Hashing'], ['unique-ids', 'Unique IDs at Scale'], ['cap', 'CAP & Consistency'], ['consensus', 'Consensus & Leaders'], ['transactions', 'Transactions & Isolation'], ['files', 'Files & Media']] },
    { id: 'communication', title: 'Communication', tone: 'var(--blue)', lessons: [
      ['apis', 'REST, RPC & GraphQL'], ['queues', 'Message Queues'], ['pubsub', 'Pub/Sub & Events'], ['realtime', 'Real-time Updates']] },
    { id: 'reliability', title: 'Reliability', tone: 'var(--red)', lessons: [
      ['redundancy', 'Redundancy & Failover'], ['rate-limiting', 'Rate Limiting'], ['timeouts-retries', 'Timeouts & Retries'], ['observability', 'Observability']] },
    { id: 'architecture', title: 'Architecture', tone: 'var(--mint)', lessons: [
      ['microservices', 'Monolith vs Microservices'], ['service-discovery', 'Service Discovery'], ['sagas', 'Sagas & Distributed Tx'], ['batch-stream', 'Batch & Stream Processing']] },
    { id: 'security', title: 'Security', tone: 'var(--orange)', lessons: [
      ['authentication', 'Authentication'], ['authorization', 'Authorization'], ['encryption', 'Encryption & Secrets']] },
    { id: 'shipping', title: 'Shipping', tone: 'var(--green)', lessons: [
      ['testing', 'Testing'], ['cicd', 'CI/CD & Deployments']] },
    { id: 'design', title: 'Whole Systems', tone: 'var(--violet)', lessons: [
      ['hld-lld', 'HLD & LLD'], ['design-url-shortener', 'Design a URL Shortener'], ['design-news-feed', 'Design a News Feed'], ['design-chat', 'Design a Chat System']] },
  ];

  const LESSONS = {};

  // ======================================================================
  LESSONS['request-lifecycle'] = {
    subtitle: 'From typing a URL to a rendered page — where every millisecond goes.',
    tags: [['Beginner', 'mint'], ['~6 min', 'sand'], ['Networking', 'violet']],
    legend: ['req', 'res'],
    steps: [
      {
        short: 'Name lookup', chapter: 'concept', title: 'First, find the address',
        body: ['Your browser knows a name like <b>shop.example</b>, but the network routes by IP address. It asks a <span class="term">DNS</span> resolver to translate.',
          'The answer is cached for a while (its TTL), so the next visit usually skips this step.'],
        callout: { kind: 'insight', text: 'DNS is a giant, distributed, heavily cached phone book.' },
        changes: ['+ Laptop', '+ DNS resolver'],
        metrics: { 'DNS': '20 ms', 'Total': '20 ms' },
        scene: {
          entities: { dev: E('client', -6, 0, 'Your laptop'), dns: E('dns', -2, -4.5, 'DNS', { tags: [{ text: 'shop.example → 203.0.113.7', tone: 'green' }] }) },
          links: { q: L('dev', 'dns', { label: '20 ms' }) },
          flows: [{ route: ['dev', 'dns'], bounce: true, rate: 0.9, speed: 0.8 }],
        },
      },
      {
        short: 'Connect', chapter: 'concept', title: 'Open a connection',
        body: ['Before any data moves, the laptop and server shake hands: TCP needs one round trip, TLS (for HTTPS) one more.',
          'Each round trip costs the full distance there and back — that’s why <b>connection reuse</b> matters so much.'],
        callout: { kind: 'tip', text: 'HTTP keep-alive and HTTP/2 let many requests share one connection, paying the handshake once.' },
        changes: ['+ Web server', '~ 2 round trips of handshake'],
        metrics: { 'DNS': '20 ms', 'Connect': '60 ms', 'Total': '80 ms' },
        scene: {
          entities: { dev: E('client', -6, 0, 'Your laptop'), dns: E('dns', -2, -4.5, 'DNS', { state: 'dim' }), web: E('server', 3, 0, 'Web server', { tags: [{ text: 'TCP + TLS', tone: 'blue' }] }) },
          links: { q: L('dev', 'dns', { style: 'off' }), h: L('dev', 'web', { label: '30 ms each way' }) },
          flows: [{ route: ['dev', 'web'], bounce: true, rate: 1.2, speed: 0.9, size: 4 }],
        },
      },
      {
        short: 'Request', chapter: 'technique', title: 'Ask, work, answer',
        body: ['Now the real request: <b>GET /products</b>. The server runs its code, asks the <span class="term">database</span> for rows, and builds the response.',
          'Notice the server itself is only a small slice of the total — most time is spent travelling.'],
        changes: ['+ Database', '~ Server → DB query: 15 ms'],
        metrics: { 'DNS': '20 ms', 'Connect': '60 ms', 'Server': '40 ms', 'Total': '120 ms' },
        scene: {
          entities: { dev: E('client', -6, 0, 'Your laptop'), dns: E('dns', -2, -4.5, 'DNS', { state: 'dim' }), web: E('server', 3, 0, 'Web server'), db: E('db', 7.5, 0, 'Database') },
          links: { q: L('dev', 'dns', { style: 'off' }), h: L('dev', 'web'), s: L('web', 'db', { label: '15 ms' }) },
          flows: [{ route: ['dev', 'web', 'db'], bounce: true, rate: 1, speed: 0.9, work: 0.2 }],
        },
      },
      {
        short: 'Slow query', chapter: 'problem', title: 'When one query hurts',
        body: ['A missing index turns a 15 ms query into 900 ms. Every page view now waits on it — and the server holds a connection open the whole time.',
          'Latency problems usually hide in <b>one</b> place. Measure before you optimise.'],
        callout: { kind: 'warn', text: 'The slowest dependency sets the pace for the whole request.' },
        changes: ['~ DB query: 15 → 900 ms'],
        metrics: { 'Server': '925 ms', 'Total': '1005 ms' },
        bad: ['Server', 'Total'],
        scene: {
          entities: { dev: E('client', -6, 0, 'Your laptop'), web: E('server', 3, 0, 'Web server', { tags: [{ text: 'waiting…', tone: 'amber' }] }), db: E('db', 7.5, 0, 'Database', { tags: [{ text: 'full table scan', tone: 'red' }] }) },
          links: { h: L('dev', 'web'), s: L('web', 'db', { label: '900 ms', labelTone: 'red' }) },
          flows: [{ route: ['dev', 'web', 'db'], bounce: true, rate: 0.8, speed: 0.9, delay: { db: 1.4 } }],
        },
      },
      {
        short: 'Recap', chapter: 'recap', title: 'Where the time went',
        body: ['With the index back, the page is ready in about 155 ms — and only ~25 ms of that was actual work.',
          `<ul class="takeaways"><li><b>DNS</b> turns names into addresses, and is cached.</li><li>Every connection costs <b>round trips</b>; reuse them.</li><li>Server time is often the smallest slice — unless a slow query sneaks in.</li><li><b>Distance</b> multiplies every round trip.</li></ul>`],
        callout: { kind: 'next', text: 'Next up: <b>Latency & Throughput</b> — what happens when thousands of users arrive at once.' },
        metrics: { 'DNS': '20 ms', 'Connect': '60 ms', 'Request': '55 ms', 'Download': '20 ms', 'Total': '155 ms' },
        good: ['Total'],
        scene: {
          entities: { dev: E('client', -6, 0, 'Your laptop', { tags: [{ text: 'page ready · 155 ms', tone: 'green' }] }), dns: E('dns', -2, -4.5, 'DNS'), web: E('server', 3, 0, 'Web server'), db: E('db', 7.5, 0, 'Database') },
          links: { q: L('dev', 'dns', { style: 'off', label: '20 ms' }), h: L('dev', 'web', { label: '135 ms' }), s: L('web', 'db', { label: '15 ms' }) },
          flows: [{ route: ['dev', 'web', 'db'], bounce: true, rate: 1.3, speed: 1 }],
        },
      },
    ],
  };

  // ======================================================================
  LESSONS['vertical-horizontal'] = {
    subtitle: 'Bigger machine, or more machines? Two ways to handle more traffic.',
    tags: [['Beginner', 'mint'], ['~5 min', 'sand'], ['Scaling', 'violet']],
    legend: ['req', 'res', 'err'],
    steps: [
      {
        short: 'One server', chapter: 'concept', title: 'It starts with one box',
        body: ['Every product starts here: users talk to a single server that does everything.',
          'Cheap, simple, easy to debug. At 1,000 users it’s barely awake.'],
        changes: ['+ Users', '+ One server'],
        metrics: { Users: '1k', 'Req/s': '30', CPU: '3%', Errors: '0%' },
        scene: {
          entities: { users: users(), s: E('server', 2, 0, 'Server', { tags: [{ text: 'CPU 3%', tone: 'green' }] }) },
          links: { l: L('users', 's') },
          flows: [{ route: ['users', 's'], bounce: true, rate: 1 }],
        },
      },
      {
        short: 'Overload', chapter: 'problem', title: 'Traffic grows, the box chokes',
        body: ['Launch day: 200× the traffic. CPU pins at 100%, requests queue up, and some time out entirely.',
          'Users see spinners and errors. Something has to give.'],
        callout: { kind: 'warn', text: 'A single server is also a <b>single point of failure</b> — if it crashes, you’re offline.' },
        changes: ['~ Users 1k → 200k', '~ CPU 3% → 100%'],
        metrics: { Users: '200k', 'Req/s': '6k', CPU: '100%', Errors: '12%' },
        bad: ['CPU', 'Errors'],
        scene: {
          entities: { users: users(), s: E('server', 2, 0, 'Server', { tags: [{ text: 'CPU 100%', tone: 'red' }] }) },
          links: { l: L('users', 's') },
          flows: [{ route: ['users', 's'], bounce: true, rate: 6, delay: { s: 0.5 }, drop: { at: 's', p: 0.25 } }],
        },
      },
      {
        short: 'Scale up', chapter: 'technique', title: 'Vertical: buy a bigger box',
        body: ['<span class="term">Vertical scaling</span> means more CPU, RAM and disk in the same machine. No code changes — just a restart.',
          'It works great until you hit the biggest machine money can buy, and the price grows faster than the power.'],
        callout: { kind: 'tip', text: 'Scale up first. It’s the cheapest engineering you’ll ever do.' },
        changes: ['~ 4 cores → 64 cores', '~ $80 → $2,400 / month'],
        metrics: { Users: '200k', 'Req/s': '6k', CPU: '40%', Errors: '0%' },
        good: ['Errors'],
        scene: {
          entities: { users: users(), s: E('big', 2, 0, 'Big server', { sub: '64 cores · 512 GB', tags: [{ text: 'CPU 40%', tone: 'green' }] }) },
          links: { l: L('users', 's') },
          flows: [{ route: ['users', 's'], bounce: true, rate: 6 }],
        },
      },
      {
        short: 'Scale out', chapter: 'technique', title: 'Horizontal: add more boxes',
        body: ['<span class="term">Horizontal scaling</span> runs many ordinary servers side by side. Need more capacity? Add another.',
          'There’s no ceiling and one crash no longer takes you down — but now something has to split the traffic between them.'],
        callout: { kind: 'next', text: 'That “something” is a <b>load balancer</b> — the next lesson.' },
        changes: ['+ Servers B and C', '~ CPU ≈ 35% each'],
        metrics: { Users: '200k', 'Req/s': '6k', CPU: '35%', Errors: '0%' },
        good: ['Errors'],
        scene: {
          entities: { users: users(), a: E('server', 2, -3.2, 'Server A'), b: E('server', 2, 0, 'Server B'), c: E('server', 2, 3.2, 'Server C') },
          links: { la: L('users', 'a', { style: 'dashed' }), lb_: L('users', 'b', { style: 'dashed' }), lc: L('users', 'c', { style: 'dashed' }) },
          flows: [{ route: ['users', ['a', 'b', 'c']], pick: 'random', bounce: true, rate: 6 }],
        },
      },
      {
        short: 'Recap', chapter: 'recap', title: 'Up first, then out',
        body: [`<ul class="takeaways"><li><b>Vertical</b>: simple, no code changes, hard ceiling, single point of failure.</li><li><b>Horizontal</b>: near-unlimited and fault tolerant, but needs stateless servers and a way to spread traffic.</li><li>Most real systems do both.</li></ul>`],
        callout: { kind: 'next', text: 'Next up: <b>Load Balancing</b>.' },
        metrics: { Vertical: 'easy', Horizontal: 'resilient' },
        scene: {
          entities: { users: users(), a: E('server', 2, -3.2, 'Server A'), b: E('server', 2, 0, 'Server B'), c: E('server', 2, 3.2, 'Server C') },
          links: { la: L('users', 'a', { style: 'dashed' }), lb_: L('users', 'b', { style: 'dashed' }), lc: L('users', 'c', { style: 'dashed' }) },
          flows: [{ route: ['users', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 4 }],
        },
      },
    ],
  };

  // ======================================================================
  LESSONS['load-balancing'] = {
    subtitle: 'One public address, many servers behind it — and how requests get shared.',
    tags: [['Beginner', 'mint'], ['~7 min', 'sand'], ['Scaling', 'violet']],
    legend: ['req', 'res', 'err'],
    steps: [
      {
        short: 'The problem', chapter: 'problem', title: 'Which server do I call?',
        body: ['We have three servers, but users only know one address. Handing out every server’s IP means clients must pick — and when a server dies, they keep calling it.'],
        changes: ['3 servers, no coordination'],
        metrics: { 'Req/s': '6k', Healthy: '3 / 3', Errors: '0%' },
        scene: {
          entities: { users: users(), ...pool3() },
          links: { la: L('users', 'a', { style: 'dashed' }), lb_: L('users', 'b', { style: 'dashed' }), lc: L('users', 'c', { style: 'dashed' }) },
          flows: [{ route: ['users', ['a', 'b', 'c']], pick: 'random', bounce: true, rate: 4 }],
        },
      },
      {
        short: 'Add an LB', chapter: 'concept', title: 'A single front door',
        body: ['A <span class="term">load balancer</span> (LB) becomes the one public address. Clients connect to it; it forwards each request to a server behind it and relays the answer back.',
          'Servers can now come and go without clients ever knowing.'],
        callout: { kind: 'insight', text: 'The servers behind a load balancer are called its <b>pool</b> (or target group).' },
        changes: ['+ Load balancer', '~ Users now talk to the LB'],
        metrics: { 'Req/s': '6k', Healthy: '3 / 3', Errors: '0%', p95: '90 ms' },
        scene: {
          entities: { users: users(), lb: E('lb', -2.2, 0, 'Load balancer'), ...pool3() },
          links: { u: L('users', 'lb'), ...poolLinks() },
          flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'random', bounce: true, rate: 4.5 }],
        },
      },
      {
        short: 'Round robin', chapter: 'technique', title: 'Round robin: take turns',
        body: ['The simplest rule is <span class="term">round robin</span>: A, then B, then C, then A again. Watch the requests go out in turn.',
          'Cheap and fair — as long as servers are equally powerful and requests cost about the same.'],
        callout: { kind: 'tip', text: '<b>Weighted</b> round robin gives bigger servers a bigger share, e.g. A : B : C = 2 : 1 : 1.' },
        changes: ['~ Strategy: round robin', '~ Slowed down so you can follow each request'],
        metrics: { 'Req/s': '6k', Healthy: '3 / 3', Errors: '0%', p95: '90 ms' },
        scene: {
          entities: { users: users(), lb: E('lb', -2.2, 0, 'Load balancer', { tags: [{ text: 'round robin', tone: 'amber' }] }), ...pool3() },
          links: { u: L('users', 'lb'), ...poolLinks() },
          flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 1.4, speed: 0.7 }],
        },
      },
      {
        short: 'A server dies', chapter: 'problem', title: 'Server B crashes',
        body: ['Round robin is blind. It keeps sending one in three requests to B, and every one of them fails.',
          'A third of your users see errors, even though two healthy servers have plenty of room.'],
        callout: { kind: 'warn', text: 'Without health information, a load balancer spreads failures as evenly as it spreads load.' },
        changes: ['~ Server B: down', '~ Errors 0% → 33%'],
        metrics: { 'Req/s': '6k', Healthy: '2 / 3', Errors: '33%', p95: '90 ms' },
        bad: ['Errors', 'Healthy'],
        scene: {
          entities: { users: users(), lb: E('lb', -2.2, 0, 'Load balancer'), ...pool3({ b: { state: 'down', tags: [{ text: 'crashed', tone: 'red' }] } }) },
          links: { u: L('users', 'lb'), la: L('lb', 'a'), lb_: L('lb', 'b', { style: 'broken' }), lc: L('lb', 'c') },
          flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', blind: true, bounce: true, rate: 3 }],
        },
      },
      {
        short: 'Health checks', chapter: 'technique', title: 'Health checks route around failure',
        body: ['The LB pings each server every few seconds (<code>GET /health</code>). After a few misses, B is pulled from the pool. When it recovers, it’s added back.',
          'Errors drop back to zero, and A and C absorb B’s share.'],
        changes: ['+ Health checks every 5 s', '~ B removed from pool'],
        metrics: { 'Req/s': '6k', Healthy: '2 / 3', Errors: '0%', CPU: '52%' },
        good: ['Errors'],
        scene: {
          entities: { users: users(), lb: E('lb', -2.2, 0, 'Load balancer', { tags: [{ text: 'health checks', tone: 'green' }] }), ...pool3({ a: { tags: [{ text: '✓ healthy', tone: 'green' }] }, b: { state: 'down', tags: [{ text: 'out of pool', tone: 'red' }] }, c: { tags: [{ text: '✓ healthy', tone: 'green' }] } }) },
          links: { u: L('users', 'lb'), la: L('lb', 'a'), lb_: L('lb', 'b', { style: 'off' }), lc: L('lb', 'c') },
          flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 4 }],
        },
      },
      {
        short: 'Recap', chapter: 'recap', title: 'What the LB gives you',
        body: [`<ul class="takeaways"><li>One stable address in front of a changing pool.</li><li>A strategy: round robin, weighted, least connections, or hashing.</li><li><b>Health checks</b> so failures don’t reach users.</li><li>The LB itself must be redundant — run a pair.</li></ul>`],
        callout: { kind: 'next', text: 'Next up: <b>Stateless Services</b> — why any server must be able to answer any request.' },
        metrics: { 'Req/s': '6k', Healthy: '3 / 3', Errors: '0%', p95: '85 ms' },
        good: ['Errors', 'Healthy'],
        scene: {
          entities: { users: users(), lb: E('lb', -2.2, 0, 'Load balancer'), ...pool3() },
          links: { u: L('users', 'lb'), ...poolLinks() },
          flows: [{ route: ['users', 'lb', ['a', 'b', 'c']], pick: 'rr', bounce: true, rate: 5 }],
        },
      },
    ],
  };

  // ======================================================================
  const cacheScene = (hitP, extra = {}) => ({
    entities: { users: users(), app: E('server', -1.5, 0, 'App server'), cache: E('cache', 3, -3.5, 'Cache', { sub: 'in memory', tags: extra.cacheTags }), db: E('db', 6, 1, 'Database', { tags: extra.dbTags }) },
    links: { u: L('users', 'app'), c: L('app', 'cache', { label: '1 ms' }), d: L('app', 'db', { label: '40 ms' }) },
    flows: [
      { route: ['users', 'app', 'cache'], hit: { at: 'cache', p: 1 }, rate: extra.rate * hitP || 0.0001 },
      { route: ['users', 'app', 'db'], bounce: true, rate: extra.rate * (1 - hitP) || 0.0001, delay: extra.delay },
    ],
  });

  LESSONS['caching'] = {
    subtitle: 'Keep hot answers close, so the database only does the work once.',
    tags: [['Intermediate', 'violet'], ['~7 min', 'sand'], ['Performance', 'mint']],
    legend: ['req', 'res', 'hit'],
    steps: [
      {
        short: 'DB bound', chapter: 'problem', title: 'Everyone asks the same question',
        body: ['Your homepage shows the same top-10 products to everyone. Every visit runs the same expensive query, and the database is sweating.'],
        changes: ['Every request → database'],
        metrics: { 'Hit rate': '0%', 'DB load': '95%', p95: '320 ms' },
        bad: ['DB load', 'p95'],
        scene: {
          entities: { users: users(), app: E('server', -1.5, 0, 'App server'), db: E('db', 6, 1, 'Database', { tags: [{ text: 'CPU 95%', tone: 'red' }] }) },
          links: { u: L('users', 'app'), d: L('app', 'db', { label: '40 ms' }) },
          flows: [{ route: ['users', 'app', 'db'], bounce: true, rate: 5, delay: { db: 0.4 } }],
        },
      },
      {
        short: 'Add a cache', chapter: 'concept', title: 'Remember the answer',
        body: ['A <span class="term">cache</span> is a fast key–value store in memory (Redis, Memcached). Before hitting the database, the app checks the cache.',
          'A <b>hit</b> returns in about a millisecond. A <b>miss</b> goes to the database, then stores the answer for next time.'],
        callout: { kind: 'insight', text: 'This pattern is called <b>cache-aside</b>: the app manages the cache itself.' },
        changes: ['+ Cache', '~ Hit rate climbs to 90%'],
        metrics: { 'Hit rate': '90%', 'DB load': '12%', p95: '25 ms' },
        good: ['Hit rate', 'DB load', 'p95'],
        scene: cacheScene(0.9, { rate: 5, cacheTags: [{ text: 'hit 90%', tone: 'green' }], dbTags: [{ text: 'CPU 12%', tone: 'green' }] }),
      },
      {
        short: 'Stale data', chapter: 'problem', title: 'The cache can lie',
        body: ['A product’s price changes in the database, but the cache still holds the old value. Users see yesterday’s price until the entry expires.',
          'Caching trades freshness for speed. You have to decide how stale is acceptable.'],
        callout: { kind: 'warn', text: '“There are only two hard things in computer science: cache invalidation and naming things.”' },
        changes: ['~ DB price: $20 → $25', '~ Cache still says $20'],
        metrics: { 'Hit rate': '90%', 'Stale reads': 'yes' },
        bad: ['Stale reads'],
        scene: cacheScene(0.9, { rate: 4, cacheTags: [{ text: 'price: $20', tone: 'red' }], dbTags: [{ text: 'price: $25', tone: 'green' }] }),
      },
      {
        short: 'TTL & invalidate', chapter: 'technique', title: 'Expire it, or delete it',
        body: ['Two tools: a <span class="term">TTL</span> makes every entry expire after, say, 60 seconds. And on every write, the app <b>deletes</b> the cached key so the next read fetches fresh data.',
          'Together they bound how stale anything can be.'],
        callout: { kind: 'tip', text: 'Delete on write rather than update on write — it avoids races between two concurrent writers.' },
        changes: ['+ TTL 60 s', '+ Invalidate on write'],
        metrics: { 'Hit rate': '85%', 'Max staleness': '60 s', p95: '28 ms' },
        good: ['p95'],
        scene: cacheScene(0.85, { rate: 5, cacheTags: [{ text: 'TTL 60s', tone: 'amber' }], dbTags: [{ text: 'price: $25', tone: 'green' }] }),
      },
      {
        short: 'Recap', chapter: 'recap', title: 'Cache what’s read often',
        body: [`<ul class="takeaways"><li>Caches serve hot data from memory in ~1 ms.</li><li>Hit rate is the number that matters.</li><li>Use <b>TTLs</b> and <b>invalidation</b> to bound staleness.</li><li>Watch for a <b>stampede</b> when a hot key expires and everyone misses at once.</li></ul>`],
        callout: { kind: 'next', text: 'Next up: <b>Content Delivery</b> — caching at the edge of the internet.' },
        metrics: { 'Hit rate': '90%', 'DB load': '12%', p95: '25 ms' },
        good: ['Hit rate'],
        scene: cacheScene(0.9, { rate: 5 }),
      },
    ],
  };

  // ======================================================================
  LESSONS['replication'] = {
    subtitle: 'Copies of your data on several machines — for reads, and for survival.',
    tags: [['Intermediate', 'violet'], ['~6 min', 'sand'], ['Databases', 'mint']],
    legend: ['req', 'res', 'msg'],
    steps: [
      {
        short: 'One DB', chapter: 'problem', title: 'All eggs, one basket',
        body: ['Your app servers scale out nicely, but they all share one database. It’s the bottleneck for reads, and if its disk dies, so does your data.'],
        metrics: { 'Read load': '90%', Copies: '1' },
        bad: ['Read load', 'Copies'],
        scene: {
          entities: { app: E('server', -4, 0, 'App servers'), p: E('db', 2, 0, 'Database', { tags: [{ text: 'reads + writes', tone: 'red' }] }) },
          links: { w: L('app', 'p') },
          flows: [{ route: ['app', 'p'], bounce: true, rate: 5 }],
        },
      },
      {
        short: 'Replicas', chapter: 'concept', title: 'Leader and followers',
        body: ['One node is the <span class="term">leader</span>: all writes go there. It streams every change to <span class="term">followers</span> (replicas), which apply them in order.',
          'Each follower holds a full copy of the data.'],
        changes: ['+ Replica 1', '+ Replica 2', '~ Changes stream from the leader'],
        metrics: { Copies: '3', 'Read load': '90%' },
        scene: {
          entities: { app: E('server', -4, 0, 'App servers'), p: E('db', 2, 0, 'Leader'), r1: E('db', 6.5, -3.5, 'Replica 1'), r2: E('db', 6.5, 3.5, 'Replica 2') },
          links: { w: L('app', 'p'), s1: L('p', 'r1', { style: 'dashed' }), s2: L('p', 'r2', { style: 'dashed' }) },
          flows: [{ route: ['app', 'p'], bounce: true, rate: 3 }, { route: ['p', ['r1', 'r2']], pick: 'rr', kind: 'msg', rate: 3, speed: 0.6 }],
        },
      },
      {
        short: 'Read scaling', chapter: 'technique', title: 'Send reads to replicas',
        body: ['Most apps read far more than they write. Point reads at the replicas and keep the leader for writes.',
          'Add replicas to add read capacity.'],
        changes: ['~ Reads → replicas', '~ Writes → leader'],
        metrics: { Copies: '3', 'Leader load': '30%', 'Read capacity': '3×' },
        good: ['Leader load', 'Read capacity'],
        scene: {
          entities: { app: E('server', -4, 0, 'App servers'), p: E('db', 2, 0, 'Leader', { tags: [{ text: 'writes', tone: 'amber' }] }), r1: E('db', 6.5, -3.5, 'Replica 1', { tags: [{ text: 'reads', tone: 'green' }] }), r2: E('db', 6.5, 3.5, 'Replica 2', { tags: [{ text: 'reads', tone: 'green' }] }) },
          links: { w: L('app', 'p'), s1: L('p', 'r1', { style: 'dashed' }), s2: L('p', 'r2', { style: 'dashed' }), q1: L('app', 'r1', { style: 'off' }), q2: L('app', 'r2', { style: 'off' }) },
          flows: [{ route: ['app', 'p'], bounce: true, rate: 1 }, { route: ['app', ['r1', 'r2']], pick: 'rr', bounce: true, rate: 4 }, { route: ['p', ['r1', 'r2']], pick: 'rr', kind: 'msg', rate: 1, speed: 0.6 }],
        },
      },
      {
        short: 'Lag', chapter: 'problem', title: 'Replication lag',
        body: ['Replication is usually <b>asynchronous</b>: the leader confirms a write before followers have it. A user who saves a profile and immediately reloads may read from a replica that’s 200 ms behind — and see the old version.'],
        callout: { kind: 'tip', text: '<b>Read-your-writes</b>: route a user’s reads to the leader for a few seconds after they write.' },
        metrics: { Lag: '200 ms', 'Stale reads': 'possible' },
        bad: ['Stale reads'],
        scene: {
          entities: { app: E('server', -4, 0, 'App servers'), p: E('db', 2, 0, 'Leader', { tags: [{ text: 'v2', tone: 'green' }] }), r1: E('db', 6.5, -3.5, 'Replica 1', { tags: [{ text: 'v1 · 200 ms behind', tone: 'red' }] }), r2: E('db', 6.5, 3.5, 'Replica 2', { tags: [{ text: 'v2', tone: 'green' }] }) },
          links: { w: L('app', 'p'), s1: L('p', 'r1', { style: 'dashed' }), s2: L('p', 'r2', { style: 'dashed' }), q1: L('app', 'r1', { style: 'off' }) },
          flows: [{ route: ['app', 'p'], bounce: true, rate: 1.5 }, { route: ['p', ['r1', 'r2']], pick: 'rr', kind: 'msg', rate: 1.5, speed: 0.3 }],
        },
      },
      {
        short: 'Recap', chapter: 'recap', title: 'Copies buy you two things',
        body: [`<ul class="takeaways"><li><b>Read scale</b>: more replicas, more reads.</li><li><b>Durability</b>: a dead disk doesn’t lose data; a replica can be promoted.</li><li>Async replication means <b>lag</b> — design for it.</li><li>Replication doesn’t scale <b>writes</b>; that needs sharding.</li></ul>`],
        callout: { kind: 'next', text: 'Next up: <b>Sharding</b> — splitting data so writes scale too.' },
        metrics: { Copies: '3', 'Read capacity': '3×' },
        scene: {
          entities: { app: E('server', -4, 0, 'App servers'), p: E('db', 2, 0, 'Leader'), r1: E('db', 6.5, -3.5, 'Replica 1'), r2: E('db', 6.5, 3.5, 'Replica 2') },
          links: { w: L('app', 'p'), s1: L('p', 'r1', { style: 'dashed' }), s2: L('p', 'r2', { style: 'dashed' }) },
          flows: [{ route: ['app', 'p'], bounce: true, rate: 2 }, { route: ['p', ['r1', 'r2']], pick: 'rr', kind: 'msg', rate: 2, speed: 0.6 }],
        },
      },
    ],
  };

  // ======================================================================
  const qEnts = (o = {}) => ({
    api: E('server', -5, 0, 'API'),
    q: E('queue', 0.5, 0, 'Queue', { count: o.count || 0 }),
    w1: E('worker', 5.5, -2.8, 'Worker 1', o.w1),
    ...(o.more ? { w2: E('worker', 5.5, 0, 'Worker 2'), w3: E('worker', 5.5, 2.8, 'Worker 3') } : {}),
  });

  LESSONS['queues'] = {
    subtitle: 'Accept work now, do it later — and survive the spikes.',
    tags: [['Intermediate', 'violet'], ['~6 min', 'sand'], ['Async', 'mint']],
    legend: ['req', 'msg'],
    steps: [
      {
        short: 'Sync work', chapter: 'problem', title: 'Making the user wait',
        body: ['Uploading a video triggers transcoding that takes 30 seconds. If the API does it inline, the request hangs, connections pile up, and a spike knocks everything over.'],
        metrics: { 'Response': '30 s', Timeouts: 'many' },
        bad: ['Response', 'Timeouts'],
        scene: {
          entities: { users: users(), api: E('server', -1, 0, 'API', { tags: [{ text: 'busy transcoding', tone: 'red' }] }) },
          links: { u: L('users', 'api') },
          flows: [{ route: ['users', 'api'], bounce: true, rate: 3, delay: { api: 1.5 }, drop: { at: 'api', p: 0.3 } }],
        },
      },
      {
        short: 'Enqueue', chapter: 'concept', title: 'Drop a note in the queue',
        body: ['The API writes a small <span class="term">message</span> — “transcode video 42” — to a <span class="term">queue</span> and replies <b>202 Accepted</b> immediately.',
          'A separate <span class="term">worker</span> pulls messages off and does the slow part at its own pace.'],
        changes: ['+ Queue', '+ Worker', '~ API replies in 20 ms'],
        metrics: { Response: '20 ms', Backlog: 'low' },
        good: ['Response'],
        scene: {
          entities: qEnts(),
          links: { a: L('api', 'q'), b: L('q', 'w1') },
          flows: [{ route: ['api', 'q'], sink: true, kind: 'msg', rate: 1 }, { route: ['q', 'w1'], pull: true, kind: 'msg', rate: 1.2, speed: 0.8 }],
        },
      },
      {
        short: 'A spike', chapter: 'problem', title: 'The backlog grows',
        body: ['A viral moment: messages arrive 4× faster than one worker can handle. Nothing crashes — the queue simply <b>absorbs</b> the spike — but the backlog keeps growing.'],
        callout: { kind: 'insight', text: 'Queues turn traffic spikes into <b>delay</b> instead of <b>errors</b>.' },
        changes: ['~ Arrivals 1/s → 4/s'],
        metrics: { Arrivals: '4/s', Processing: '1/s', Backlog: 'growing' },
        bad: ['Backlog'],
        scene: {
          entities: qEnts({ count: 3, w1: { tags: [{ text: '100% busy', tone: 'amber' }] } }),
          links: { a: L('api', 'q'), b: L('q', 'w1') },
          flows: [{ route: ['api', 'q'], sink: true, kind: 'msg', rate: 4 }, { route: ['q', 'w1'], pull: true, kind: 'msg', rate: 1, speed: 0.8 }],
        },
      },
      {
        short: 'More workers', chapter: 'technique', title: 'Scale consumers independently',
        body: ['Add workers. Each pulls the next message, so work spreads automatically. The backlog drains, and you can scale workers on queue depth alone.'],
        callout: { kind: 'tip', text: 'Messages must be safe to process twice (<b>idempotent</b>): most queues deliver <i>at least once</i>.' },
        changes: ['+ Worker 2', '+ Worker 3'],
        metrics: { Arrivals: '4/s', Processing: '4.5/s', Backlog: 'draining' },
        good: ['Backlog'],
        scene: {
          entities: qEnts({ count: 12, more: true }),
          links: { a: L('api', 'q'), b: L('q', 'w1'), c: L('q', 'w2'), d: L('q', 'w3') },
          flows: [{ route: ['api', 'q'], sink: true, kind: 'msg', rate: 4 }, { route: ['q', ['w1', 'w2', 'w3']], pick: 'rr', pull: true, kind: 'msg', rate: 5, speed: 0.8 }],
        },
      },
      {
        short: 'Recap', chapter: 'recap', title: 'Decouple fast from slow',
        body: [`<ul class="takeaways"><li>Producers and consumers no longer need to be up at the same time.</li><li>Spikes become backlog, not outages.</li><li>Scale workers on <b>queue depth</b>.</li><li>Design for retries, duplicates, and a dead-letter queue for poison messages.</li></ul>`],
        callout: { kind: 'next', text: 'Next up: <b>Pub/Sub & Events</b> — one message, many listeners.' },
        metrics: { Response: '20 ms', Backlog: 'stable' },
        scene: {
          entities: qEnts({ more: true }),
          links: { a: L('api', 'q'), b: L('q', 'w1'), c: L('q', 'w2'), d: L('q', 'w3') },
          flows: [{ route: ['api', 'q'], sink: true, kind: 'msg', rate: 3 }, { route: ['q', ['w1', 'w2', 'w3']], pick: 'rr', pull: true, kind: 'msg', rate: 4, speed: 0.8 }],
        },
      },
    ],
  };

  // ======================================================================
  LESSONS['rate-limiting'] = {
    subtitle: 'Protect a service from too much of a good thing.',
    tags: [['Intermediate', 'violet'], ['~5 min', 'sand'], ['Reliability', 'mint']],
    legend: ['req', 'res', 'err'],
    steps: [
      {
        short: 'A flood', chapter: 'problem', title: 'One client, all the capacity',
        body: ['A buggy script retries in a tight loop, sending 2,000 requests a second. Your API slows down for <b>everyone</b>.'],
        metrics: { 'Bad client': '2k/s', p95: '1.8 s' },
        bad: ['p95'],
        scene: {
          entities: { bot: E('client', -6, -3, 'Script', { tags: [{ text: '2k req/s', tone: 'red' }] }), users: E('users', -6, 3, 'Users'), api: E('server', 3, 0, 'API', { tags: [{ text: 'CPU 100%', tone: 'red' }] }) },
          links: { a: L('bot', 'api'), b: L('users', 'api') },
          flows: [{ route: ['bot', 'api'], bounce: true, rate: 9, delay: { api: 0.4 } }, { route: ['users', 'api'], bounce: true, rate: 1, delay: { api: 0.8 } }],
        },
      },
      {
        short: 'Token bucket', chapter: 'technique', title: 'A bucket of tokens',
        body: ['A <span class="term">token bucket</span> gives each client, say, 10 tokens that refill at 5 per second. Each request spends one. No tokens? The limiter answers <b>429 Too Many Requests</b> without touching the API.',
          'Short bursts are allowed; sustained floods are not.'],
        changes: ['+ Rate limiter', '~ Limit: 5 req/s per client, burst 10'],
        metrics: { 'Bad client': '5/s allowed', p95: '60 ms' },
        good: ['p95'],
        scene: {
          entities: { bot: E('client', -7, -3, 'Script'), users: E('users', -7, 3, 'Users'), rl: E('lb', -1.5, 0, 'Rate limiter', { tags: [{ text: '429 when empty', tone: 'amber' }] }), api: E('server', 4, 0, 'API', { tags: [{ text: 'CPU 30%', tone: 'green' }] }) },
          links: { a: L('bot', 'rl'), b: L('users', 'rl'), c: L('rl', 'api') },
          flows: [{ route: ['bot', 'rl', 'api'], bounce: true, rate: 9, drop: { at: 'rl', p: 0.8 } }, { route: ['users', 'rl', 'api'], bounce: true, rate: 1.5 }],
        },
      },
      {
        short: 'Recap', chapter: 'recap', title: 'Fair share for everyone',
        body: [`<ul class="takeaways"><li>Limit per client (API key, user, IP).</li><li>Token bucket allows bursts; sliding window is stricter.</li><li>Keep counters in a shared store (e.g. Redis) when you run many limiters.</li><li>Return <b>429</b> with a <code>Retry-After</code> header.</li></ul>`],
        callout: { kind: 'next', text: 'Next up: <b>Timeouts & Retries</b>.' },
        metrics: { p95: '60 ms', Errors: '0% (users)' },
        good: ['p95'],
        scene: {
          entities: { bot: E('client', -7, -3, 'Script'), users: E('users', -7, 3, 'Users'), rl: E('lb', -1.5, 0, 'Rate limiter'), api: E('server', 4, 0, 'API') },
          links: { a: L('bot', 'rl'), b: L('users', 'rl'), c: L('rl', 'api') },
          flows: [{ route: ['bot', 'rl', 'api'], bounce: true, rate: 6, drop: { at: 'rl', p: 0.7 } }, { route: ['users', 'rl', 'api'], bounce: true, rate: 2 }],
        },
      },
    ],
  };

  Object.assign(LESSONS, window.EXTRA_LESSONS || {});

  // Lessons not written yet get a placeholder so every link works.
  for (const ch of CHAPTERS) {
    for (const [id, title] of ch.lessons) {
      const l = LESSONS[id] || {
        placeholder: true,
        subtitle: 'This lesson is still being drawn.',
        tags: [['Coming soon', 'sand']],
        legend: ['req', 'res'],
        steps: [{
          short: 'Soon', chapter: 'concept', title: 'Coming soon',
          body: [`<b>${title}</b> is on the roadmap. Meanwhile, try one of the finished lessons — they’re marked in the course menu.`],
          callout: { kind: 'next', text: 'Start with <b>How a Request Travels</b> or <b>Load Balancing</b>.' },
          metrics: {},
          scene: {
            entities: { users: users(), s: E('server', 2, 0, title.length > 18 ? title.slice(0, 18) + '…' : title, { tags: [{ text: 'coming soon', tone: 'amber' }] }) },
            links: { l: L('users', 's', { style: 'dashed' }) },
            flows: [{ route: ['users', 's'], bounce: true, rate: 0.8 }],
          },
        }],
      };
      l.id = id; l.title = title; l.chapter = ch.id;
      LESSONS[id] = l;
    }
  }

  window.COURSE = { CHAPTERS, LESSONS };
})();
