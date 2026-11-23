/* The non-lesson pages: Practice (quiz), Design Lab (sandbox), Cheatsheets. */
(function () {
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sd:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sd:' + k, JSON.stringify(v)); } catch {} },
  };

  // =================== PRACTICE ===================
  const Q = [
    ['foundations', 'Your service gets 10M requests per day. Roughly what is the average QPS?', ['~10', '~100', '~1,000', '~100,000'], 1, '10M ÷ ~100k seconds per day ≈ 100 req/s.'],
    ['foundations', 'Which usually dominates the latency of a simple web request from far away?', ['CPU time on the server', 'Network round trips', 'Rendering HTML', 'Disk space'], 1, 'Each round trip pays the full distance; handshakes add several.'],
    ['foundations', 'A server runs at 95% CPU. What happens to latency?', ['Stays flat', 'Drops', 'Rises sharply as queues form', 'Becomes zero'], 2, 'Near saturation, small load increases cause large queueing delays.'],
    ['foundations', 'Which metric best reflects what most users experience at the slow end?', ['Average latency', 'p99 latency', 'Minimum latency', 'Uptime'], 1, 'Averages hide the tail; p95/p99 show what unlucky users feel.'],
    ['scaling', 'What is the main limit of vertical scaling?', ['Needs code changes', 'Hard ceiling and single point of failure', 'Requires a load balancer', 'Cannot run databases'], 1, 'There’s a biggest machine, and one box can still fail.'],
    ['scaling', 'A load balancer keeps sending traffic to a crashed server. What’s missing?', ['TLS', 'Health checks', 'A CDN', 'Sharding'], 1, 'Health checks remove unhealthy targets from the pool.'],
    ['scaling', 'Why should web servers be stateless?', ['To use less RAM', 'So any server can handle any request', 'To avoid databases', 'So they can skip TLS'], 1, 'Move sessions to a shared store so servers are interchangeable.'],
    ['scaling', 'In cache-aside, what happens on a miss?', ['Return an error', 'Read DB, then populate the cache', 'Write to the DB', 'Clear the whole cache'], 1, 'The app loads from the database and stores the result for next time.'],
    ['scaling', 'How do you ship a new version of app.js through a CDN with long TTLs?', ['Purge every edge hourly', 'Use a content-hashed filename', 'Disable the CDN', 'Lower TTL to 1 s'], 1, 'A new URL means edges fetch it fresh, while old files stay cached.'],
    ['data', 'What does an index mainly speed up?', ['Writes', 'Reads that filter or sort on the indexed column', 'Backups', 'Replication'], 1, 'Indexes turn scans into lookups but add cost to writes.'],
    ['data', 'Read replicas help scale…', ['Writes', 'Reads', 'Both equally', 'Neither'], 1, 'All writes still go through the leader.'],
    ['data', 'A user updates their profile, reloads, and sees the old version. Likely cause?', ['Index missing', 'Replication lag', 'Sharding', 'DNS cache'], 1, 'The read hit a replica that hadn’t applied the write yet.'],
    ['data', 'What is the biggest risk of a poor shard key?', ['Too much encryption', 'Hot shards with uneven load', 'Slower DNS', 'Fewer indexes'], 1, 'A skewed key concentrates traffic on one shard.'],
    ['data', 'With consistent hashing, adding one node to N nodes moves about…', ['All keys', 'Half the keys', '~1/N of keys', 'No keys'], 2, 'Only keys on the arc the new node takes over move.'],
    ['data', 'During a network partition, a CP system will…', ['Serve stale data', 'Reject some requests to stay consistent', 'Delete data', 'Ignore the partition'], 1, 'CP chooses correctness over availability.'],
    ['data', 'How many nodes does Raft need to tolerate 2 failures?', ['3', '4', '5', '6'], 2, '2f + 1 = 5.'],
    ['data', 'Where should 5 MB user photos live?', ['In a DB BLOB column', 'In object storage, with a key in the DB', 'In the cache', 'On app server disk'], 1, 'Object stores are cheap and durable; the DB keeps metadata.'],
    ['communication', 'A queue between API and workers mainly turns traffic spikes into…', ['Errors', 'Delay (backlog)', 'Data loss', 'Higher prices'], 1, 'The queue absorbs bursts; workers drain at their own pace.'],
    ['communication', 'Most queues deliver at-least-once. Consumers must therefore be…', ['Stateless', 'Idempotent', 'Synchronous', 'Encrypted'], 1, 'Processing the same message twice must be safe.'],
    ['communication', 'Pub/sub differs from a work queue because…', ['Messages are smaller', 'Every subscriber gets each message', 'It’s synchronous', 'It needs SQL'], 1, 'Queues: one consumer per message. Topics: fan-out to all.'],
    ['communication', 'Best fit for internal, high-performance service-to-service calls?', ['SOAP', 'gRPC', 'FTP', 'Polling'], 1, 'Binary Protobuf over HTTP/2 with typed contracts.'],
    ['communication', 'Which gives a persistent two-way channel for chat?', ['Short polling', 'WebSockets', 'DNS', 'CDN'], 1, 'One upgraded connection carries messages both ways.'],
    ['reliability', 'Retries should use…', ['Fixed 0 ms delay', 'Exponential backoff with jitter', 'Infinite attempts', 'A new connection each time only'], 1, 'Backoff + jitter avoids synchronized retry storms.'],
    ['reliability', 'A circuit breaker in the OPEN state…', ['Sends all traffic', 'Fails fast without calling the dependency', 'Restarts servers', 'Encrypts traffic'], 1, 'It gives the failing dependency time to recover.'],
    ['reliability', '99.99% availability allows roughly how much downtime per year?', ['3.6 days', '8.8 hours', '52 minutes', '5 seconds'], 2, 'Four nines ≈ 52.6 minutes/year.'],
    ['reliability', 'A token bucket rate limiter allows…', ['No bursts ever', 'Short bursts up to bucket size', 'Unlimited traffic', 'Only one client'], 1, 'Tokens accumulate up to capacity, permitting bursts.'],
    ['reliability', 'What should page an on-call engineer?', ['CPU at 70%', 'SLO burn / user-facing errors', 'A new deploy', 'Disk at 20%'], 1, 'Alert on symptoms users feel.'],
    ['architecture', 'In microservices, each service should…', ['Share one big database', 'Own its own data', 'Avoid APIs', 'Deploy together'], 1, 'Owning data keeps services independently deployable.'],
    ['architecture', 'A saga undoes completed steps using…', ['Two-phase commit', 'Compensating actions', 'Rollbacks in one DB', 'Backups'], 1, 'Each step has an inverse that runs on failure.'],
    ['architecture', 'Need fraud detection within seconds of each transaction. Batch or stream?', ['Batch', 'Stream', 'Neither', 'Cron job monthly'], 1, 'Streams process each event as it arrives.'],
    ['security', 'How should passwords be stored?', ['Plain text', 'MD5', 'Salted slow hash (bcrypt/argon2)', 'Base64'], 2, 'Slow salted hashes resist brute force.'],
    ['security', 'A downside of JWTs vs server sessions?', ['Need a DB lookup', 'Hard to revoke before expiry', 'Can’t hold claims', 'Not signed'], 1, 'Keep JWT lifetimes short or maintain a deny-list.'],
    ['security', 'Alice can view Bob’s invoice by changing the ID in the URL. This is a failure of…', ['Authentication', 'Authorization', 'Encryption', 'Caching'], 1, 'She’s authenticated, but not authorized for that resource.'],
    ['shipping', 'A canary deployment…', ['Deploys to all servers at once', 'Sends a small % of traffic to the new version first', 'Only runs tests', 'Deletes old versions'], 1, 'Watch metrics on a slice before rolling out further.'],
    ['design', 'URL shortener: why base62 encode a unique ID?', ['It’s encrypted', 'Short, URL-safe, collision-free codes', 'Required by HTTP', 'Faster DNS'], 1, '62⁷ ≈ 3.5T codes, and unique IDs never collide.'],
    ['design', 'News feed: why not push every celebrity post to 50M followers?', ['Too slow/expensive on write', 'Not allowed', 'Feeds are pull-only', 'Caches can’t store IDs'], 0, 'Hybrid: pull celebrity posts at read time.'],
  ];
  const CH_NAMES = { all: 'All', foundations: 'Foundations', scaling: 'Scaling', data: 'Data', communication: 'Communication', reliability: 'Reliability', architecture: 'Architecture', security: 'Security', shipping: 'Shipping', design: 'Whole Systems' };

  function practice(root) {
    let filter = 'all', list = [], i = 0, score = 0, answered = false;
    const best = store.get('quizBest', {});
    const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
    function start() {
      list = shuffle(Q.filter((q) => filter === 'all' || q[0] === filter));
      i = 0; score = 0; answered = false; render();
    }
    function render() {
      const chips = Object.entries(CH_NAMES).map(([k, v]) => `<button class="chip ${k === filter ? 'is-on' : ''}" data-f="${k}">${v}${best[k] != null ? ` <small>${best[k]}%</small>` : ''}</button>`).join('');
      let body;
      if (i >= list.length) {
        const pct = Math.round((score / list.length) * 100);
        if (best[filter] == null || pct > best[filter]) { best[filter] = pct; store.set('quizBest', best); }
        body = `<div class="card qcard qdone"><span class="eyebrow">Finished</span><h2>${score} / ${list.length} correct · ${pct}%</h2>
          <p>${pct >= 80 ? 'Excellent — you know this material.' : pct >= 50 ? 'Good progress. Revisit the lessons you missed.' : 'Worth another pass through the lessons.'}</p>
          <button class="btn btn--primary" id="q-again">Try again</button></div>`;
      } else {
        const q = list[i];
        body = `<div class="card qcard">
          <div class="qhead"><span class="eyebrow">${CH_NAMES[q[0]]} · Question ${i + 1} of ${list.length}</span><span class="qscore">Score ${score}</span></div>
          <div class="bar"><span style="width:${(i / list.length) * 100}%"></span></div>
          <h2>${q[1]}</h2>
          <div class="qopts">${q[2].map((o, n) => `<button class="qopt" data-n="${n}"><span class="qkey">${'ABCD'[n]}</span>${o}</button>`).join('')}</div>
          <div class="qexp" id="qexp" hidden></div>
          <div class="qfoot"><button class="btn btn--primary" id="q-next" disabled>Next question</button></div></div>`;
      }
      root.innerHTML = `<div class="page"><div class="page__head"><span class="eyebrow">Practice</span><h1 class="title">Check your understanding</h1>
        <p class="subtitle">${Q.length} questions across the course. Pick a topic or mix them all.</p></div>
        <div class="chips">${chips}</div>${body}</div>`;
      root.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f; start(); }));
      root.querySelector('#q-again')?.addEventListener('click', start);
      root.querySelectorAll('.qopt').forEach((b) => (b.onclick = () => answer(+b.dataset.n)));
      const next = root.querySelector('#q-next');
      if (next) next.onclick = () => { i++; answered = false; render(); };
    }
    function answer(n) {
      if (answered) return;
      answered = true;
      const q = list[i];
      if (n === q[3]) score++;
      root.querySelectorAll('.qopt').forEach((b, k) => {
        b.disabled = true;
        if (k === q[3]) b.classList.add('is-right');
        else if (k === n) b.classList.add('is-wrong');
      });
      const exp = root.querySelector('#qexp');
      exp.hidden = false;
      exp.className = `qexp callout callout--${n === q[3] ? 'next' : 'warn'}`;
      exp.innerHTML = `<div><span class="callout__title">${n === q[3] ? 'Correct' : 'Not quite'}</span>${q[4]}</div>`;
      root.querySelector('#q-next').disabled = false;
      root.querySelector('.qscore').textContent = `Score ${score}`;
    }
    start();
    return {
      key(e) {
        if (/^[1-4a-d]$/i.test(e.key)) { const n = isNaN(+e.key) ? 'abcd'.indexOf(e.key.toLowerCase()) : +e.key - 1; answer(n); }
        else if (e.key === 'Enter') root.querySelector('#q-next:not([disabled])')?.click();
      },
    };
  }

  // =================== CHEATSHEETS ===================
  const table = (rows, head) => `<table class="cs-table">${head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const SHEETS = [
    ['Latency numbers', 'orange', table([['L1 cache reference', '1 ns'], ['Main memory reference', '100 ns'], ['Compress 1 KB (fast)', '2 µs'], ['Read 1 MB from memory', '10 µs'], ['SSD random read', '100 µs'], ['Round trip in same datacenter', '0.5 ms'], ['Read 1 MB from SSD', '1 ms'], ['Disk seek (HDD)', '10 ms'], ['Round trip US ↔ Europe', '~80 ms'], ['Round trip US ↔ Australia', '~200 ms']])],
    ['Sizes & time', 'green', table([['1 day', '86,400 s ≈ 10⁵ s'], ['1 month', '≈ 2.5M s'], ['2¹⁰', '1 thousand (KB)'], ['2²⁰', '1 million (MB)'], ['2³⁰', '1 billion (GB)'], ['2⁴⁰', '1 trillion (TB)'], ['char / int / long', '1 / 4 / 8 bytes'], ['UUID', '16 bytes'], ['Tweet-sized text', '~300 bytes'], ['Photo / 1 min HD video', '~200 KB / ~50 MB']])],
    ['Availability', 'violet', table([['99%', '3.65 days'], ['99.9%', '8.77 hours'], ['99.95%', '4.38 hours'], ['99.99%', '52.6 minutes'], ['99.999%', '5.26 minutes']], ['Uptime', 'Downtime / year']) + '<p class="cs-note">Components in series multiply: two 99.9% services in a chain ≈ 99.8%. In parallel: 1 − (0.001)² ≈ 99.9999%.</p>'],
    ['HTTP status codes', 'blue', table([['200 / 201 / 204', 'OK / Created / No content'], ['301 / 302 / 304', 'Moved / Found / Not modified'], ['400', 'Bad request'], ['401 / 403', 'Unauthenticated / Forbidden'], ['404 / 409', 'Not found / Conflict'], ['429', 'Too many requests'], ['500', 'Server error'], ['502 / 503 / 504', 'Bad gateway / Unavailable / Timeout']])],
    ['Pick a database', 'violet', table([['Relational data, transactions', 'Postgres, MySQL'], ['Key-value, huge scale', 'DynamoDB, Redis'], ['Flexible documents', 'MongoDB'], ['Write-heavy time series / logs', 'Cassandra, ClickHouse'], ['Relationships / graph queries', 'Neo4j'], ['Full-text search', 'Elasticsearch'], ['Files & media', 'S3 / object storage'], ['Analytics warehouse', 'BigQuery, Snowflake']])],
    ['Caching strategies', 'red', table([['Cache-aside', 'App reads cache, falls back to DB, fills cache'], ['Read-through', 'Cache loads from DB itself on miss'], ['Write-through', 'Write cache + DB together (fresh, slower writes)'], ['Write-back', 'Write cache, flush to DB later (fast, risk of loss)'], ['TTL', 'Bound staleness by expiry'], ['Eviction', 'LRU, LFU, FIFO']])],
    ['Scaling checklist', 'green', '<ol class="cs-list"><li>Measure first: find the actual bottleneck.</li><li>Scale up the box.</li><li>Make servers stateless; add a load balancer.</li><li>Cache hot reads; CDN for static files.</li><li>Read replicas for the database.</li><li>Queues for slow or bursty work.</li><li>Shard when writes or data outgrow one leader.</li><li>Multi-AZ, then multi-region.</li></ol>'],
    ['Interview framework', 'orange', '<ol class="cs-list"><li><b>Requirements</b> (5 min): functional + non-functional.</li><li><b>Estimates</b>: QPS, storage, bandwidth.</li><li><b>API</b>: key endpoints.</li><li><b>Data model</b>: entities, keys, DB choice.</li><li><b>High-level design</b>: boxes and arrows.</li><li><b>Deep dives</b>: bottlenecks, scaling, failure.</li><li><b>Trade-offs</b>: say what you gave up and why.</li></ol>'],
    ['Consistency patterns', 'blue', table([['Strong', 'Reads see the latest write (single leader, consensus)'], ['Eventual', 'Replicas converge over time'], ['Read-your-writes', 'A user always sees their own updates'], ['Monotonic reads', 'Never go back in time'], ['Causal', 'Cause is seen before effect'], ['Quorum', 'R + W > N for overlap']])],
  ];
  function cheatsheets(root) {
    root.innerHTML = `<div class="page"><div class="page__head"><span class="eyebrow">Cheatsheets</span><h1 class="title">Numbers and patterns to keep handy</h1>
      <p class="subtitle">Quick reference for estimates, trade-offs and interviews.</p></div>
      <div class="cs-grid">${SHEETS.map(([t, tone, html]) => `<section class="card cs"><h3><span class="chapter__dot" style="background:var(--${tone})"></span>${t}</h3>${html}</section>`).join('')}</div></div>`;
    return {};
  }

  window.VIEWS = {
    practice: { nav: 'Practice', render: practice },
    lab: { nav: 'Design Lab', render: (el) => window.awsLab(el) },
    cheatsheets: { nav: 'Cheatsheets', render: cheatsheets },
  };
})();
