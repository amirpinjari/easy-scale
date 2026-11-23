/* AWS Design Lab: compose an architecture from AWS services, see capacity,
   latency, errors, availability and an estimated monthly bill, export as PDF.
   Prices are approximate on-demand list prices (USD), no free tier; other
   regions are scaled from us-east-1 with an approximate multiplier. */
(function () {
  const HRS = 730; // hours per month
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sd:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sd:' + k, JSON.stringify(v)); } catch {} },
  };

  // ---- catalogue: [vCPU, GiB, $/hour, perf factor] ----
  const EC2 = {
    't3.micro': [2, 1, 0.0104, 0.35], 't3.small': [2, 2, 0.0208, 0.45], 't3.medium': [2, 4, 0.0416, 0.5], 't3.large': [2, 8, 0.0832, 0.6],
    'm5.large': [2, 8, 0.096, 1], 'm5.xlarge': [4, 16, 0.192, 1], 'm5.2xlarge': [8, 32, 0.384, 1],
    'c5.large': [2, 4, 0.085, 1.2], 'c5.xlarge': [4, 8, 0.17, 1.2], 'c5.2xlarge': [8, 16, 0.34, 1.2],
    'c6g.xlarge': [4, 8, 0.136, 1.15], 'r5.large': [2, 16, 0.126, 0.9],
  };
  const FARGATE = { '0.25 vCPU · 0.5 GB': [0.25, 0.5], '0.5 vCPU · 1 GB': [0.5, 1], '1 vCPU · 2 GB': [1, 2], '2 vCPU · 4 GB': [2, 4], '4 vCPU · 8 GB': [4, 8] };
  const FARGATE_VCPU_HR = 0.04048, FARGATE_GB_HR = 0.004445;

  // ---- Lambda ----
  const LAMBDA_MEM = [128, 256, 512, 768, 1024, 1536, 1769, 2048, 3008, 4096, 6144, 8192, 10240];
  const OLD_LAMBDA_MEM = [128, 256, 512, 1024, 1769, 3008]; // earlier versions stored an index into this
  const LAMBDA_TIMEOUT = [1, 3, 5, 10, 15, 29, 60, 300, 900]; // seconds
  const LAMBDA_PC = [0, 5, 25, 100, 500, 1000, 3000];
  const LAMBDA_CONC = [1000, 3000, 10000, 30000];
  const LAMBDA_GBS = { x86: 0.0000166667, arm: 0.0000133334 };
  const LAMBDA_PC_GBS = { x86: 0.0000041667, arm: 0.0000033334 };

  // ---- regions: [name, price multiplier vs us-east-1 (approx.), $/GB egress] ----
  const REGIONS = {
    'us-east-1': ['N. Virginia', 1.0, 0.09],
    'us-east-2': ['Ohio', 1.0, 0.09],
    'us-west-2': ['Oregon', 1.0, 0.09],
    'ca-central-1': ['Canada', 1.08, 0.09],
    'eu-west-1': ['Ireland', 1.1, 0.09],
    'eu-west-2': ['London', 1.13, 0.09],
    'eu-central-1': ['Frankfurt', 1.15, 0.09],
    'ap-south-1': ['Mumbai', 1.05, 0.1093],
    'ap-southeast-1': ['Singapore', 1.2, 0.12],
    'ap-southeast-2': ['Sydney', 1.22, 0.114],
    'ap-northeast-1': ['Tokyo', 1.25, 0.114],
    'sa-east-1': ['São Paulo', 1.55, 0.15],
  };
  // when adding regions, spread them across continents in this order
  const SPREAD = ['us-east-1', 'eu-west-1', 'ap-southeast-1', 'us-west-2', 'ap-northeast-1', 'eu-central-1', 'sa-east-1', 'ap-south-1', 'ap-southeast-2', 'us-east-2', 'eu-west-2', 'ca-central-1'];
  const regionList = (primary, n) => [primary, ...SPREAD.filter((r) => r !== primary)].slice(0, n);

  // [vCPU, $/hour, perf factor]
  const RDS = { 'db.t3.micro': [2, 0.017, 0.35], 'db.t3.medium': [2, 0.068, 0.5], 'db.m5.large': [2, 0.171, 1], 'db.m5.xlarge': [4, 0.342, 1], 'db.m5.2xlarge': [8, 0.684, 1], 'db.r5.large': [2, 0.24, 1.2], 'db.r5.2xlarge': [8, 0.96, 1.2] };
  // [$/hour, ops/s]
  const CACHE = { 'cache.t3.micro': [0.017, 20e3], 'cache.t3.medium': [0.068, 50e3], 'cache.m5.large': [0.156, 100e3], 'cache.r6g.large': [0.206, 150e3] };
  const USERS = [1e3, 1e4, 5e4, 1e5, 5e5, 1e6, 5e6, 1e7, 5e7];
  const REQ_PER_USER = [5, 20, 50, 100];
  // share of the daily peak, hour by hour (local time of most users)
  const DAY = [0.3, 0.22, 0.17, 0.14, 0.13, 0.15, 0.22, 0.35, 0.5, 0.6, 0.66, 0.7, 0.74, 0.72, 0.7, 0.7, 0.74, 0.8, 0.88, 0.96, 1, 0.92, 0.7, 0.45];
  const DEFAULT = {
    users: 3, reqPerUser: 20, spike: false,
    region: 'us-east-1', regions: 1,
    compute: 'ec2', ec2Type: 't3.medium', ec2Count: 1, ecsSize: '0.5 vCPU · 1 GB', ecsTasks: 2, autoscale: false, asgMax: 10,
    lambdaMem: 512, lambdaTimeout: 10, lambdaArch: 'x86', lambdaFns: 1, lambdaPC: 0, lambdaConc: 1000,
    alb: false, apigw: false, apigwType: 'http', waf: false, cloudfront: false, s3: false, sqs: false,
    cache: false, cacheType: 'cache.t3.medium', rdsType: 'db.t3.medium', replicas: 0, multiAz: false,
  };

  const fmt = (n) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
  const usd = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;
  const over = (u) => (u > 1 ? Math.min(0.95, 1 - 1 / u) : 0);
  const wait = (u) => (u < 0.7 ? 0 : u < 0.98 ? 25 / (1 - u) - 83 : 1500);
  const secs = (t) => (t >= 60 ? `${t / 60} min` : `${t} s`);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const MAX_FNS = 10000;
  // log-scale slider for the function count: 0..1000 → 1..10,000
  const fnsToSlider = (n) => Math.round(Math.log10(n) * 250);
  const sliderToFns = (x) => { const v = Math.pow(10, x / 250); return clamp(v < 20 ? Math.round(v) : v < 200 ? Math.round(v / 5) * 5 : v < 2000 ? Math.round(v / 50) * 50 : Math.round(v / 500) * 500, 1, MAX_FNS); };

  function normalise(s) {
    if (s.lambdaMem < 64) s.lambdaMem = OLD_LAMBDA_MEM[s.lambdaMem] || 512;
    if (!LAMBDA_MEM.includes(s.lambdaMem)) s.lambdaMem = 512;
    if (!LAMBDA_TIMEOUT.includes(s.lambdaTimeout)) s.lambdaTimeout = 10;
    if (!REGIONS[s.region]) s.region = 'us-east-1';
    s.regions = clamp(s.regions | 0 || 1, 1, 4);
    s.lambdaFns = clamp(Math.round(+s.lambdaFns) || 1, 1, MAX_FNS);
    return s;
  }

  // =============================== MODEL ===============================
  // f: load factor relative to the daily peak (hour of day × spike)
  function model(s, f = 1) {
    const regs = regionList(s.region, s.regions);
    const R = regs.length;
    const pm = regs.reduce((a, r) => a + REGIONS[r][1], 0) / R; // blended price multiplier
    const egress = REGIONS[s.region][2];
    const users = USERS[s.users];
    const reqDay = users * s.reqPerUser;
    const monthReq = reqDay * 30;
    const avgRps = reqDay / 86400;
    const peak = avgRps * 3 * f;
    const legit = s.waf ? 0.95 : 1; // WAF rate-based rule blocks abusive traffic
    const STATIC = 0.4;
    const staticToCompute = !s.cloudfront && !s.s3;
    const computeShare = (1 - STATIC) + (staticToCompute ? STATIC : 0);
    const dynAt = (fac) => (avgRps * 3 * fac * legit * computeShare) / R; // dynamic req/s per region
    const dynPeak = peak * legit * computeShare;
    const rp = dynPeak / R;
    const dynMonth = monthReq * legit * computeShare;
    const dbPeak = peak * legit * (1 - STATIC);
    const staticMonth = monthReq * legit * STATIC;

    // ---- database: reads stay in-region, every write goes to the primary region ----
    const [dv, dprice, df] = RDS[s.rdsType];
    const readsR = (dbPeak * 0.9 / R) * (s.cache ? 0.15 : 1);
    const writes = dbPeak * 0.1;
    const readCap = dv * 400 * df, writeCap = dv * 150 * df;
    const readUtil = s.replicas ? readsR / (s.replicas * readCap) : 0;
    const leaderUtil = writes / writeCap + (s.replicas ? 0 : readsR / readCap);
    const remoteUtil = R > 1 ? readsR / (Math.max(1, s.replicas) * readCap) : 0;
    const dbUtil = Math.max(readUtil, leaderUtil, remoteUtil);
    const cacheUtil = s.cache ? (dbPeak * 0.9 / R) / CACHE[s.cacheType][1] : 0;
    const dbMs = s.cache ? 0.15 * 15 + 0.85 * 1 : 15;

    // ---- compute (per region) ----
    const inlineMs = s.sqs ? 25 : 110; // slow work (emails, thumbnails) moved off the request path by SQS
    const cpuMs = s.sqs ? 6 : 10;
    let computeUtil = 0, computeMs = 0, throttle = 0, conc = 0, lambdaDur = 0, computeCap = 0;
    let instances = 0, avgInstances = 0, timeoutRate = 0, billedDur = 0, coldShare = 0, coldMs = 0, perFnRate = 0;
    const mem = s.lambdaMem, T = s.lambdaTimeout * 1000;
    if (s.compute === 'ec2' || s.compute === 'ecs') {
      const cap1 = s.compute === 'ec2'
        ? EC2[s.ec2Type][0] * (1000 / cpuMs) * EC2[s.ec2Type][3] * 0.8
        : FARGATE[s.ecsSize][0] * (1000 / cpuMs) * 0.8;
      const base = s.compute === 'ec2' ? s.ec2Count : s.ecsTasks;
      const asg = s.autoscale && s.alb;
      const max = Math.max(base, s.asgMax);
      const sized = (load) => (asg ? clamp(Math.ceil(load / (cap1 * 0.6)), base, max) : s.alb ? base : 1);
      instances = sized(rp);
      avgInstances = asg ? DAY.reduce((a, h) => a + sized(dynAt(h)), 0) / DAY.length : base;
      computeCap = instances * cap1;
      computeUtil = rp / computeCap;
      computeMs = inlineMs + dbMs;
    } else {
      const cpuSlow = Math.max(1, 1024 / mem) * (s.lambdaArch === 'arm' ? 0.95 : 1);
      lambdaDur = 10 + dbMs + inlineMs * cpuSlow;
      const meanDur = lambdaDur + wait(dbUtil); // a slow database makes every invocation run longer
      timeoutRate = Math.exp(-T / meanDur);
      billedDur = Math.min(meanDur, T);
      conc = (rp * billedDur) / 1000; // the concurrency quota is per account, per region
      computeUtil = conc / s.lambdaConc;
      throttle = conc > s.lambdaConc ? 1 - s.lambdaConc / conc : 0;
      perFnRate = rp / s.lambdaFns;
      coldMs = 180 + (mem < 512 ? 220 : mem < 1024 ? 90 : 30);
      const pcCovers = s.lambdaPC > 0 ? clamp(s.lambdaPC / Math.max(conc, 0.01), 0, 1) : 0;
      coldShare = (perFnRate < 1 ? 0.3 : perFnRate < 20 ? 0.06 : 0.01) * (1 - pcCovers);
      computeMs = lambdaDur * 1.3 + (coldShare >= 0.05 ? coldMs : coldMs * (coldShare / 0.05));
      instances = s.lambdaFns;
    }
    const apigwLimit = 10000; // per account, per region
    const apigwThrottle = s.apigw && rp > apigwLimit ? 1 - apigwLimit / rp : 0;

    const net = Math.round(20 / (1 + 0.45 * (R - 1))); // users reach the nearest region
    let p95 = Math.round(net + (R > 1 ? 1 : 0) + (s.waf ? 1 : 0) + (s.apigw ? 12 : 0) + (s.alb ? 3 : 0) + computeMs + (s.compute === 'lambda' ? 0 : wait(computeUtil)) + wait(dbUtil));
    if (s.compute === 'lambda') p95 = Math.min(p95, T + net + 20);
    const computeErr = s.compute === 'lambda' ? 1 - (1 - throttle) * (1 - timeoutRate) : over(computeUtil);
    const errors = 1 - (1 - computeErr) * (1 - apigwThrottle) * (1 - over(dbUtil)) * (1 - over(cacheUtil));

    // ---- availability (published SLAs, multiplied in series; regions in parallel) ----
    const multi = s.compute === 'lambda' ? true : s.alb && (s.compute === 'ec2' ? s.ec2Count : s.ecsTasks) >= 2;
    const chain = [
      ['Compute', s.compute === 'lambda' ? 99.95 : multi ? 99.99 : 99.5],
      ['Database', s.multiAz ? 99.95 : 99.5],
    ];
    if (s.alb) chain.push(['ALB', 99.99]);
    if (s.apigw) chain.push(['API Gateway', 99.95]);
    const regional = chain.reduce((a, [, v]) => a * (v / 100), 1);
    // regions fail independently; failover via DNS is never perfect, so cap the gain
    const avail = R > 1 ? (1 - Math.pow(1 - regional, R)) * 99.995 : regional * 100;

    // ---- monthly bill ----
    const bill = [];
    const add = (svc, cfg, basis, cost) => bill.push({ svc, cfg, basis, cost });
    const rTxt = R > 1 ? ` · ×${R} regions` : '';
    const addR = (svc, cfg, basis, cost) => add(svc, cfg + rTxt, basis, cost * pm * R); // regional services
    if (s.compute === 'ec2') {
      const [v, g, price] = EC2[s.ec2Type];
      const n = avgInstances;
      addR('Amazon EC2', `${s.autoscale && s.alb ? `avg ${n.toFixed(1)} (min ${s.ec2Count}, max ${Math.max(s.ec2Count, s.asgMax)})` : s.ec2Count} × ${s.ec2Type} (${v} vCPU, ${g} GiB)`, `$${price}/hr × ${HRS} h + 20 GB gp3 EBS each`, n * (price * HRS + 20 * 0.08));
    } else if (s.compute === 'ecs') {
      const [v, g] = FARGATE[s.ecsSize];
      const n = avgInstances;
      addR('Amazon ECS (Fargate)', `${s.autoscale && s.alb ? `avg ${n.toFixed(1)} tasks (min ${s.ecsTasks}, max ${Math.max(s.ecsTasks, s.asgMax)})` : `${s.ecsTasks} tasks`} × ${s.ecsSize}`, `$${FARGATE_VCPU_HR}/vCPU-hr + $${FARGATE_GB_HR}/GB-hr`, n * (v * FARGATE_VCPU_HR + g * FARGATE_GB_HR) * HRS);
      addR('Amazon ECR', 'Container image repository', '$0.10/GB-month × ~2 GB', 0.2);
    } else {
      const gbs = dynMonth * (billedDur / 1000) * (mem / 1024);
      const arch = s.lambdaArch === 'arm' ? 'arm64' : 'x86_64';
      add('AWS Lambda', `${s.lambdaFns.toLocaleString()} function${s.lambdaFns > 1 ? 's' : ''} · ${mem} MB ${arch} · ~${Math.round(billedDur)} ms billed · ${fmt(dynMonth)} invocations${rTxt}`, `$0.20/M requests + $${LAMBDA_GBS[s.lambdaArch]}/GB-s`, ((dynMonth / 1e6) * 0.2 + gbs * LAMBDA_GBS[s.lambdaArch]) * pm);
      if (s.lambdaPC) addR('Lambda provisioned concurrency', `${s.lambdaPC} warm environments × ${mem} MB`, `$${LAMBDA_PC_GBS[s.lambdaArch]}/GB-s, always on`, s.lambdaPC * (mem / 1024) * HRS * 3600 * LAMBDA_PC_GBS[s.lambdaArch]);
    }
    if (s.alb) {
      const lcu = Math.max(1, ((dynMonth / R / (30 * 86400)) * 0.4) / 25);
      addR('Application Load Balancer', `${lcu.toFixed(1)} LCU avg`, '$0.0225/hr + $0.008/LCU-hr', 0.0225 * HRS + 0.008 * lcu * HRS);
    }
    if (s.apigw) {
      const per = s.apigwType === 'http' ? 1.0 : 3.5;
      add('Amazon API Gateway', `${s.apigwType === 'http' ? 'HTTP API' : 'REST API'}, ${fmt(dynMonth)} requests${rTxt}`, `$${per.toFixed(2)}/M requests`, (dynMonth / 1e6) * per * pm);
    }
    if (s.waf) add('AWS WAF', `Web ACL + rate-based rule + managed rules${rTxt}`, '$5/ACL + $1/rule + $0.60/M requests', (5 + 2) * R + (monthReq / 1e6) * 0.6);
    if (R > 1) {
      add('Amazon Route 53', `Hosted zone, latency-based routing, ${R} health checks`, '$0.50/zone + $0.60/M latency queries + $0.50/health check', 0.5 + ((monthReq * 0.02) / 1e6) * 0.6 + R * 0.5);
      const gb = ((dynMonth * 0.1 * 2) / 1e6) * (R - 1);
      add('Cross-region replication', `Writes copied to ${R - 1} region${R > 2 ? 's' : ''} (${fmt(gb)} GB)`, '$0.02/GB inter-region', gb * 0.02);
    }
    if (s.cloudfront) {
      const gb = (staticMonth * 50) / 1e6;
      add('Amazon CloudFront', `${fmt(staticMonth)} requests, ${fmt(gb)} GB out`, '$0.085/GB + $0.01/10k HTTPS req', gb * 0.085 + (staticMonth / 1e4) * 0.01);
    }
    if (s.s3) {
      const gbStored = (users * 0.5) / 1024;
      const gets = s.cloudfront ? staticMonth * 0.1 : staticMonth;
      const puts = users * 0.1 * 30;
      const eg = s.cloudfront ? 0 : (staticMonth * 50) / 1e6 * egress;
      add('Amazon S3', `${fmt(gbStored)} GB stored, ${fmt(gets)} GET`, '$0.023/GB + $0.0004/1k GET + $0.005/1k PUT' + (eg ? ' + egress' : ''), (gbStored * 0.023 + (gets / 1000) * 0.0004 + (puts / 1000) * 0.005) * REGIONS[s.region][1] + eg);
    }
    if (s.sqs) {
      const msgs = dynMonth * 0.1;
      add('Amazon SQS', `${fmt(msgs)} messages (send/receive/delete)${rTxt}`, '$0.40/M requests', ((msgs * 3) / 1e6) * 0.4 * pm);
      add('AWS Lambda (SQS consumer)', `512 MB, ~500 ms per message${rTxt}`, '$0.20/M + $0.0000166667/GB-s', ((msgs / 1e6) * 0.2 + msgs * 0.5 * 0.5 * 0.0000166667) * pm);
    }
    if (s.cache) {
      const nodes = s.multiAz ? 2 : 1;
      addR('Amazon ElastiCache (Redis)', `${nodes} × ${s.cacheType}`, `$${CACHE[s.cacheType][0]}/hr per node`, nodes * CACHE[s.cacheType][0] * HRS);
    }
    const az = s.multiAz ? 2 : 1;
    const dbInst = az + s.replicas + (R - 1) * Math.max(1, s.replicas);
    add('Amazon RDS', `${s.rdsType}${s.multiAz ? ' Multi-AZ' : ''}${s.replicas ? ` + ${s.replicas} read replica${s.replicas > 1 ? 's' : ''}` : ''}${R > 1 ? ` + ${(R - 1) * Math.max(1, s.replicas)} cross-region replica(s)` : ''}, 100 GB gp2 each`, `$${dprice}/hr per instance + $0.115/GB-month`, (dbInst * dprice * HRS + 100 * 0.115 * dbInst) * pm);
    const outGb = (dynMonth * 10) / 1e6 + (staticToCompute ? (staticMonth * 50) / 1e6 : 0);
    add('Data transfer out', `${fmt(outGb)} GB to internet`, `$${egress}/GB`, outGb * egress);
    const total = bill.reduce((a, b) => a + b.cost, 0);

    const bottleneck = s.compute === 'lambda' && throttle > 0 ? 'lambda'
      : s.compute === 'lambda' && timeoutRate > 0.005 ? 'timeout'
      : apigwThrottle > 0 ? 'apigw'
      : Math.max(computeUtil, dbUtil) < 0.75 ? null
      : s.compute !== 'lambda' && computeUtil >= dbUtil ? 'compute' : 'db';
    return { users, peak, dynPeak, rp, monthReq, computeUtil, computeCap, dbUtil, cacheUtil, conc, lambdaDur, billedDur, throttle, timeoutRate, coldShare, coldMs, perFnRate, instances, apigwThrottle, p95, errors, avail, chain, bill, total, bottleneck, regs, R, net };
  }

  const health = (m) => (m.errors > 0.01 ? 'bad' : m.p95 > 500 || m.computeUtil > 0.85 || m.dbUtil > 0.85 ? 'warn' : 'ok');

  function advice(s, m) {
    const t = [];
    const name = s.compute === 'ec2' ? 'EC2 instances' : s.compute === 'ecs' ? 'ECS tasks' : 'Lambda';
    if (s.compute !== 'lambda' && !s.alb && (s.compute === 'ec2' ? s.ec2Count : s.ecsTasks) > 1) t.push(['warn', `You have several ${name} but no Application Load Balancer, so only one receives traffic.`]);
    if (m.bottleneck === 'compute') t.push(['warn', `${name} are saturated (${Math.round(m.computeUtil * 100)}%). ${s.autoscale && s.alb ? 'Auto Scaling hit its maximum — raise it, ' : 'Turn on Auto Scaling, add more, '}pick a larger type, ${s.sqs ? '' : 'move slow work to SQS, '}or switch to Lambda.`]);
    if (m.bottleneck === 'lambda') t.push(['warn', `Lambda needs ${fmt(m.conc)} concurrent executions per region but the limit is ${s.lambdaConc.toLocaleString()}. Request a quota increase, add a region, or give functions more memory to finish faster.`]);
    if (m.bottleneck === 'timeout') t.push(['warn', `${(m.timeoutRate * 100).toFixed(1)}% of invocations hit the ${secs(s.lambdaTimeout)} timeout${m.dbUtil > 0.7 ? ' because the database is slow — fix RDS first' : ''}. Raise the timeout or make the function faster.`]);
    if (m.bottleneck === 'apigw') t.push(['warn', 'API Gateway is throttling (default 10,000 req/s per account per region). Request a limit increase, add a region, or cache at CloudFront.']);
    if (m.bottleneck === 'db') t.push(['warn', s.cache ? 'RDS is the bottleneck — add read replicas or a larger instance class.' : 'RDS is the bottleneck — add ElastiCache to absorb reads, or read replicas.']);
    if (m.cacheUtil > 0.8) t.push(['warn', 'The ElastiCache node is near its limit — choose a bigger node type.']);
    if (s.compute === 'lambda') {
      if (s.apigw && s.lambdaTimeout > 29) t.push(['tip', `API Gateway gives up after 29 s, so a ${secs(s.lambdaTimeout)} Lambda timeout only keeps billing after the client already got a 504. Use 29 s or less.`]);
      if (m.coldShare >= 0.05) t.push(['tip', `About ${Math.round(m.coldShare * 100)}% of requests hit a cold start (+${m.coldMs} ms). ${s.lambdaFns > 1 ? `Splitting traffic across ${s.lambdaFns.toLocaleString()} functions (~${m.perFnRate < 1 ? m.perFnRate.toFixed(2) : fmt(m.perFnRate)} req/s each) makes each one colder. ` : ''}Add provisioned concurrency to keep environments warm.`]);
      if (s.lambdaMem < 1024 && !s.sqs) t.push(['tip', `Lambda gives CPU in proportion to memory. At ${s.lambdaMem} MB the slow inline work runs ${(1024 / s.lambdaMem).toFixed(1)}× slower — more memory can be both faster and cheaper.`]);
      const codeGb = (s.lambdaFns * 5 * Math.max(1, m.R)) / 1024;
      if (s.lambdaFns >= 2000) t.push(['warn', `${s.lambdaFns.toLocaleString()} functions × ~5 MB of code ≈ ${codeGb.toFixed(0)} GB per region. Lambda's code-storage quota is 75 GB per region (raisable), and every function needs its own deploys, alarms and IAM role — group routes into fewer functions.`]);
      else if (s.lambdaFns >= 200) t.push(['tip', `${s.lambdaFns.toLocaleString()} functions is a lot to deploy and monitor. Use infrastructure as code (SAM/CDK) and shared layers, and watch the 75 GB code-storage quota.`]);
      if (s.lambdaArch === 'x86') t.push(['tip', 'Switch Lambda to arm64 (Graviton): about 20% cheaper per GB-second and usually a little faster.']);
      if (s.lambdaPC && s.lambdaPC > m.conc * 3) t.push(['tip', `Provisioned concurrency (${s.lambdaPC}) is far above peak need (~${fmt(m.conc)}). You are paying for idle warm environments.`]);
    }
    if (!s.multiAz) t.push(['tip', 'RDS is Single-AZ: an AZ outage takes the database down. Enable Multi-AZ for production.']);
    if (s.compute !== 'lambda' && !(s.alb && (s.compute === 'ec2' ? s.ec2Count : s.ecsTasks) >= 2)) t.push(['tip', `Run at least 2 ${name} across AZs behind an ALB to remove the single point of failure.`]);
    if (s.compute !== 'lambda' && s.alb && !s.autoscale) t.push(['tip', 'Turn on Auto Scaling so capacity follows the daily traffic curve instead of paying for peak all day.']);
    if (s.regions > 1) t.push(['tip', `Reads are served locally in ${m.R} regions, but every write still goes to ${s.region}. Users far away pay ~70–150 ms extra on writes; consider DynamoDB global tables or Aurora Global Database.`]);
    if (s.regions === 1 && m.users >= 1e6) t.push(['tip', 'At this scale a second region (Route 53 latency routing) cuts latency for distant users and survives a full region outage.']);
    if (REGIONS[s.region][1] >= 1.2) t.push(['tip', `${s.region} (${REGIONS[s.region][0]}) costs roughly ${Math.round((REGIONS[s.region][1] - 1) * 100)}% more than us-east-1. Host there only if your users or data-residency rules need it.`]);
    if (!s.cloudfront) t.push(['tip', 'Put CloudFront + S3 in front of static assets to cut latency and offload ~40% of requests.']);
    if (!s.waf && m.users >= 1e5) t.push(['tip', 'Add AWS WAF with a rate-based rule to block abusive clients and common exploits.']);
    if (s.compute === 'ec2' && s.ec2Type.startsWith('t3') && m.computeUtil > 0.4) t.push(['tip', 'T3 instances are burstable; sustained load drains CPU credits. Consider m5/c5 for steady traffic.']);
    if (m.errors === 0 && m.p95 < 250 && m.avail >= 99.8) t.unshift(['next', s.spike ? 'It survives a 5× spike. Try more users.' : 'Healthy architecture! Increase users or turn on the 5× spike to find the next bottleneck.']);
    if (m.computeUtil < 0.25 && m.dbUtil < 0.25 && s.compute !== 'lambda' && m.total > 50) t.push(['tip', 'Resources are mostly idle at peak — consider smaller instance types, fewer instances, or Savings Plans/Reserved Instances to cut cost.']);
    if (!t.length) t.push(['next', 'No issues found at this traffic level.']);
    return t;
  }

  // =============================== SCENE ===============================
  function scene(s, m) {
    const E = (kind, x, y, label, extra = {}) => ({ kind, x, y, label, ...extra });
    const L = (from, to, extra = {}) => ({ from, to, ...extra });
    const tone = (u) => (u > 1 ? 'red' : u > 0.75 ? 'amber' : 'green');
    const ent = { users: E('users', -12, 0, `${fmt(m.users)} users / day`, s.spike ? { tags: [{ text: '5× spike', tone: 'red' }] } : {}) };
    const links = {}, flows = [];
    let x = -12, front = 'users';
    const step = () => (x += 3.9);
    if (m.R > 1) { step(); ent.r53 = E('dns', x, 0, 'Route 53', { sub: 'latency routing', tags: [{ text: `${m.R} regions`, tone: 'violet' }] }); links.r53 = L(front, 'r53'); front = 'r53'; }
    if (s.waf) { step(); ent.waf = E('waf', x, 0, 'AWS WAF', { tags: [{ text: 'rate limit', tone: 'amber' }] }); links.waf = L(front, 'waf'); front = 'waf'; }
    if (s.apigw) { step(); ent.apigw = E('apigw', x, 0, 'API Gateway', { sub: s.apigwType === 'http' ? 'HTTP API' : 'REST API', tags: m.apigwThrottle ? [{ text: 'throttling 429', tone: 'red' }] : [] }); links.apigw = L(front, 'apigw'); front = 'apigw'; }
    if (s.alb) { step(); ent.alb = E('alb', x, 0, 'App Load Balancer'); links.alb = L(front, 'alb'); front = 'alb'; }
    x += 4.2;
    const cx = x;
    const lambda = s.compute === 'lambda';
    const count = lambda ? s.lambdaFns : m.instances;
    const n = lambda ? Math.min(count, 3) : s.alb ? Math.min(count, 3) : 1;
    const ys = n === 1 ? [0] : n === 2 ? [-2, 2] : [-3.7, 0, 3.7];
    const ids = [];
    const util = `${Math.min(999, Math.round(m.computeUtil * 100))}%`;
    const asg = s.autoscale && s.alb;
    const regionTxt = m.R > 1 ? ` · per region` : '';
    ys.forEach((y, i) => {
      const id = 'c' + i;
      ids.push(id);
      let e;
      if (s.compute === 'ec2') e = E('ec2', cx, y, i === 0 ? `EC2 ${s.ec2Type}${count > 1 ? ` ×${count}` : ''}` : '', i === 0 ? { sub: !s.alb && s.ec2Count > 1 ? `only 1 of ${s.ec2Count} gets traffic` : asg ? `Auto Scaling ${s.ec2Count}→${Math.max(s.ec2Count, s.asgMax)}${regionTxt}` : `fixed size${regionTxt}`, tags: [{ text: `CPU ${util}`, tone: tone(m.computeUtil) }] } : {});
      else if (s.compute === 'ecs') e = E('task', cx, y, i === 0 ? `ECS task ×${count}` : '', i === 0 ? { sub: `Fargate · ${s.ecsSize}${asg ? ' · auto' : ''}`, tags: [{ text: `CPU ${util}`, tone: tone(m.computeUtil) }] } : {});
      else {
        const tags = [];
        if (i === 0) {
          tags.push({ text: `concurrency ${fmt(m.conc)}/${fmt(s.lambdaConc)}`, tone: tone(m.computeUtil) });
          if (m.timeoutRate > 0.001) tags.push({ text: `timeouts ${(m.timeoutRate * 100).toFixed(1)}%`, tone: 'red' });
          if (s.lambdaPC) tags.push({ text: `${s.lambdaPC} warm`, tone: 'green' });
          else if (m.coldShare >= 0.05) tags.push({ text: `cold starts ${Math.round(m.coldShare * 100)}%`, tone: 'amber' });
        }
        e = E('lambda', cx, y, i === 0 ? (count > 1 ? `Lambda ×${fmt(count)} functions` : `Lambda ${s.lambdaMem} MB`) : `fn-${i + 1}`, i === 0 ? { sub: `${s.lambdaMem} MB · ${s.lambdaArch === 'arm' ? 'arm64' : 'x86'} · ${secs(s.lambdaTimeout)}`, tags } : {});
      }
      ent[id] = e;
      links['l' + id] = L(front, id);
    });
    if (s.compute === 'ecs') { ent.ecr = E('ecr', cx - 4.5, 7.5, 'Amazon ECR', { sub: 'images' }); ids.forEach((id) => (links['e' + id] = L('ecr', id, { style: 'off' }))); }
    const dx = cx + 5;
    ent.rds = E('rds', dx, s.replicas ? -1.5 : 0, `RDS ${s.rdsType}`, { sub: `${s.multiAz ? 'Multi-AZ' : 'Single-AZ'} · ${s.region}`, tags: [{ text: `load ${Math.min(999, Math.round(m.dbUtil * 100))}%`, tone: tone(m.dbUtil) }] });
    ids.forEach((id) => (links['d' + id] = L(id, 'rds', { style: 'dashed' })));
    if (s.replicas) { ent.rep = E('rds', dx + 1.5, 4.5, `Read replicas ×${s.replicas}`); links.rep = L('rds', 'rep', { style: 'dashed', label: 'async' }); }
    if (m.R > 1) { ent.xr = E('rds', dx + 5.5, -1.5, `Replicas in ${m.R - 1} region${m.R > 2 ? 's' : ''}`, { sub: m.regs.slice(1).join(', ') }); links.xr = L('rds', 'xr', { style: 'dashed', label: 'cross-region', labelTone: 'violet' }); }
    if (s.cache) { ent.cache = E('cache', cx + 3.5, -6, 'ElastiCache', { sub: s.cacheType, tags: [{ text: 'hit 85%', tone: 'green' }] }); ids.forEach((id) => (links['k' + id] = L(id, 'cache', { style: 'off' }))); }
    if (s.cloudfront) {
      ent.cf = E('cf', -8.5, -6, 'CloudFront', { tags: [{ text: 'edge cache', tone: 'green' }] });
      links.cf = L('users', 'cf', { style: 'dashed' });
      if (s.s3) { ent.s3 = E('s3', -3, -7.5, 'S3 bucket', { sub: 'static + uploads' }); links.s3 = L('cf', 's3', { style: 'dashed', label: 'origin' }); }
    } else if (s.s3) { ent.s3 = E('s3', -8, -6, 'S3 bucket', { sub: 'static + uploads' }); links.s3 = L('users', 's3', { style: 'dashed' }); }
    if (s.sqs) {
      ent.sqs = E('sqs', cx + 4.5, 8, 'Amazon SQS');
      ent.worker = E('lambda', cx + 10, 8, 'Lambda worker');
      links.sqs = L(ids[ids.length - 1], 'sqs'); links.wk = L('sqs', 'worker');
    }

    const vis = Math.min(7, 1 + Math.log10(Math.max(m.peak, 1)) * 1.05);
    const route = ['users'];
    if (m.R > 1) route.push('r53');
    if (s.waf) route.push('waf');
    if (s.apigw) route.push('apigw');
    if (s.alb) route.push('alb');
    route.push(ids.length > 1 ? ids : ids[0]);
    const tail = s.cache ? 'cache' : s.replicas ? ['rds', 'rep'] : 'rds';
    const main = { route: [...route, tail], pick: 'rr', bounce: true, rate: vis * 0.6 };
    if (s.cache) main.hit = { at: 'cache', p: 0.85 };
    // show failures where they happen (with a cache, DB failures appear on the miss flow below)
    if (m.errors > 0.001 && !(m.bottleneck === 'db' && s.cache)) {
      const at = m.bottleneck === 'apigw' ? 'apigw' : m.bottleneck === 'db' ? 'rds' : ids[0];
      main.drop = { at, p: Math.min(0.95, m.errors) };
    }
    if (m.p95 > 400) main.delay = { [ids[0]]: Math.min(1.2, m.p95 / 1500) };
    flows.push(main);
    if (s.cache) flows.push({ route: [...route, s.replicas ? ['rds', 'rep'] : 'rds'], pick: 'rr', bounce: true, rate: vis * 0.1, ...(m.bottleneck === 'db' ? { drop: { at: 'rds', p: m.errors } } : {}) });
    if (m.R > 1) flows.push({ route: ['rds', 'xr'], kind: 'msg', rate: Math.min(2, vis * 0.25), size: 4 });
    if (s.cloudfront) flows.push({ route: s.s3 ? ['users', 'cf', 's3'] : ['users', 'cf'], hit: { at: 'cf', p: s.s3 ? 0.9 : 1 }, bounce: true, rate: vis * 0.35 });
    else if (s.s3) flows.push({ route: ['users', 's3'], bounce: true, rate: vis * 0.35 });
    if (s.waf) flows.push({ route: ['users', ...(m.R > 1 ? ['r53'] : []), 'waf'], rate: vis * 0.08, drop: { at: 'waf', p: 1 } });
    if (s.sqs) {
      flows.push({ route: [ids[ids.length - 1], 'sqs'], sink: true, kind: 'msg', rate: Math.min(3, vis * 0.4) });
      flows.push({ route: ['sqs', 'worker'], pull: true, kind: 'msg', rate: Math.min(3, vis * 0.4) + 0.4 });
    }
    if (s.compute === 'ecs') flows.push({ route: ['ecr', ids[0]], kind: 'msg', rate: 0.25, speed: 0.5, size: 4 });
    return { entities: ent, links, flows };
  }

  // =============================== UI ===============================
  const opt = (v, label) => `<option value="${v}">${label}</option>`;
  const tog = (k, label, desc) => `<label class="toggle"><input type="checkbox" data-k="${k}" /><span class="toggle__box"></span><span><b>${label}</b><small>${desc}</small></span></label>`;
  const seg = (key, items) => `<div class="seg seg--${items.length}" role="radiogroup">${items.map(([v, l]) => `<button data-seg="${key}" data-v="${v}" role="radio">${l}</button>`).join('')}</div>`;
  const memLabel = (mb) => `${mb >= 1024 ? `${+(mb / 1024).toFixed(2)} GB` : `${mb} MB`} — ${(mb / 1769).toFixed(mb < 1769 ? 2 : 1)} vCPU${mb === 1769 ? ' (1 full vCPU)' : ''}`;
  const hh = (h) => `${String(h).padStart(2, '0')}:00`;

  // ---- cloud providers: AWS is live, the others are on the way ----
  const PROVIDERS = [
    ['aws', 'AWS', 'Amazon Web Services', 'live'],
    ['gcp', 'GCP', 'Google Cloud', 'soon'],
    ['azure', 'Azure', 'Microsoft Azure', 'soon'],
  ];
  // [what it does, AWS, Google Cloud, Azure]
  const EQUIV = [
    ['CDN / edge cache', 'CloudFront', 'Cloud CDN', 'Azure Front Door'],
    ['Object storage', 'S3', 'Cloud Storage', 'Blob Storage'],
    ['Web firewall / rate limit', 'AWS WAF', 'Cloud Armor', 'Azure WAF'],
    ['API front door', 'API Gateway', 'API Gateway / Apigee', 'API Management'],
    ['Layer-7 load balancer', 'Application Load Balancer', 'Cloud Load Balancing', 'Application Gateway'],
    ['Virtual machines', 'EC2 + Auto Scaling', 'Compute Engine + MIGs', 'Virtual Machines + VM Scale Sets'],
    ['Serverless containers', 'ECS Fargate', 'Cloud Run', 'Container Apps'],
    ['Functions', 'Lambda', 'Cloud Run functions', 'Azure Functions'],
    ['Managed SQL', 'RDS', 'Cloud SQL', 'Azure Database for PostgreSQL / MySQL'],
    ['Global SQL', 'Aurora Global Database', 'Spanner', 'Azure Cosmos DB for PostgreSQL'],
    ['In-memory cache', 'ElastiCache (Redis)', 'Memorystore', 'Azure Cache for Redis'],
    ['Queue', 'SQS', 'Pub/Sub · Cloud Tasks', 'Service Bus · Queue Storage'],
    ['DNS / global routing', 'Route 53', 'Cloud DNS + global LB', 'Azure DNS · Traffic Manager'],
    ['Container registry', 'ECR', 'Artifact Registry', 'Container Registry'],
  ];
  const SOON = {
    gcp: { regions: 'us-central1 · europe-west1 · asia-southeast1 …', notes: ['Per-second VM billing with automatic sustained-use discounts', 'Cloud Run scales containers to zero, billed per 100 ms', 'One global HTTP(S) load balancer with a single anycast IP'] },
    azure: { regions: 'eastus · westeurope · southeastasia …', notes: ['VM Scale Sets with autoscale rules', 'Functions on Consumption, Flex or Premium plans (warm instances)', 'Front Door combines global routing, CDN and WAF'] },
  };
  const provTabs = (cur) => `<div class="prov" role="tablist" aria-label="Cloud provider">${PROVIDERS.map(([id, short, name, st]) =>
    `<button class="prov__tab prov__tab--${id} ${id === cur ? 'is-on' : ''}" role="tab" aria-selected="${id === cur}" data-prov="${id}" title="${name}${st === 'soon' ? ' — coming soon' : ''}"><i class="prov__dot"></i><span>${short}</span>${st === 'soon' ? '<small>Soon</small>' : ''}</button>`).join('')}</div>`;
  function soonPanel(id) {
    const [, short, name] = PROVIDERS.find((p) => p[0] === id);
    const col = id === 'gcp' ? 2 : 3;
    const info = SOON[id];
    return `<section class="card soon soon--${id}">
      <div class="soon__hero">
        <div class="soon__badge"><span class="pulse"></span>Coming soon</div>
        <h2>${name} lab</h2>
        <p>Design the same architecture on ${short}: pick services and sizes, push traffic at it, play a day, and get a monthly bill in ${short} prices. Until then, here is how the AWS lab maps across.</p>
        <ul class="soon__notes">${info.notes.map((n) => `<li>${n}</li>`).join('')}</ul>
        <p class="lab__note">Planned regions: ${info.regions}</p>
        <button class="btn btn--primary" data-prov="aws">Use the AWS lab now →</button>
      </div>
      <div class="soon__map"><span class="eyebrow">Service equivalents</span>
        <div class="bom__scroll"><table class="cs-table soon__table"><thead><tr><th>Need</th><th>AWS</th><th>${short}</th></tr></thead>
        <tbody>${EQUIV.map((r, i) => `<tr style="--i:${i}"><td>${r[0]}</td><td>${r[1]}</td><td><b>${r[col]}</b></td></tr>`).join('')}</tbody></table></div></div>
    </section>`;
  }

  function awsLab(root) {
    const s = normalise(Object.assign({}, DEFAULT, store.get('awslab', {})));
    let hour = null; // null = daily peak
    let timer = null;
    const prev = {};

    const prov = ((p) => (PROVIDERS.some((x) => x[0] === p) ? p : 'aws'))(store.get('labProvider', 'aws'));
    root.innerHTML = `<div class="page lab">
      ${provTabs(prov)}
      <div class="page__head lab__head" ${prov !== 'aws' ? 'hidden' : ''}>
        <div><span class="eyebrow">Design Lab · AWS</span><h1 class="title">Design your AWS architecture</h1>
        <p class="subtitle">Pick regions, services and sizes, push traffic at it, play a whole day, and see capacity, latency, availability and the monthly bill.</p></div>
        <div class="lab__actions"><button class="btn" id="lab-reset">Reset</button><button class="btn btn--primary" id="lab-pdf">Export PDF</button></div>
      </div>
      <div id="prov-soon">${prov !== 'aws' ? soonPanel(prov) : ''}</div>
      <div id="prov-aws" ${prov !== 'aws' ? 'hidden' : ''}>
      <div class="lab__grid">
        <section class="card lab__controls">
          <div class="lab__sec"><span class="eyebrow">Traffic</span>
            <label class="lab__row"><span>Daily active users</span><b id="v-users"></b></label>
            <input type="range" min="0" max="${USERS.length - 1}" data-r="users" />
            <label class="lab__row"><span>Requests per user / day</span></label>
            <select data-s="reqPerUser" data-num>${REQ_PER_USER.map((v) => opt(v, `${v} requests${v === 20 ? ' (typical app)' : v >= 50 ? ' (chatty / real-time)' : ' (light)'}`)).join('')}</select>
            ${tog('spike', 'Traffic spike ×5', 'Flash sale, launch day or going viral')}</div>

          <div class="lab__sec"><span class="eyebrow">Region</span>
            <label class="lab__row"><span>Primary region</span></label>
            <select data-s="region">${Object.entries(REGIONS).map(([k, [n, mult]]) => opt(k, `${k} — ${n}${mult !== 1 ? ` (≈${mult > 1 ? '+' : ''}${Math.round((mult - 1) * 100)}%)` : ''}`)).join('')}</select>
            <label class="lab__row"><span>Active regions</span><b id="v-regions"></b></label>
            <input type="range" min="1" max="4" data-r="regions" />
            <p class="lab__note" id="v-region-list"></p></div>

          <div class="lab__sec"><span class="eyebrow">Edge</span>
            ${tog('cloudfront', 'Amazon CloudFront', 'CDN for static assets (~40% of requests)')}
            ${tog('s3', 'Amazon S3', 'Static files and user uploads')}
            ${tog('waf', 'AWS WAF (rate limiter)', 'Rate-based rule blocks abusive clients')}
            ${tog('apigw', 'Amazon API Gateway', 'Managed API front door, throttling, auth')}
            <div class="lab__sub" data-show="apigw"><select data-s="apigwType">${opt('http', 'HTTP API — $1.00/M')}${opt('rest', 'REST API — $3.50/M')}</select></div>
            ${tog('alb', 'Application Load Balancer', 'Spreads traffic across instances/tasks')}</div>

          <div class="lab__sec"><span class="eyebrow">Compute</span>
            ${seg('compute', [['ec2', 'EC2'], ['ecs', 'ECS Fargate'], ['lambda', 'Lambda']])}
            <div data-only="ec2">
              <label class="lab__row"><span>Instance type</span></label><select data-s="ec2Type">${Object.keys(EC2).map((k) => opt(k, `${k} — ${EC2[k][0]} vCPU, ${EC2[k][1]} GiB RAM, $${EC2[k][2]}/hr`)).join('')}</select>
              <label class="lab__row"><span id="t-ec2Count">Instances</span><b id="v-ec2Count"></b></label><input type="range" min="1" max="20" data-r="ec2Count" /></div>
            <div data-only="ecs">
              <label class="lab__row"><span>Task size (vCPU · RAM)</span></label><select data-s="ecsSize">${Object.keys(FARGATE).map((k) => opt(k, k)).join('')}</select>
              <label class="lab__row"><span id="t-ecsTasks">Running tasks</span><b id="v-ecsTasks"></b></label><input type="range" min="1" max="40" data-r="ecsTasks" />
              <p class="lab__note">Images are pulled from <b>Amazon ECR</b> (added automatically).</p></div>
            <div data-only="ec2 ecs">
              ${tog('autoscale', 'Auto Scaling', 'Add capacity to hold ~60% CPU, remove it when quiet')}
              <div class="lab__sub" data-show="autoscale">
                <label class="lab__row"><span>Maximum</span><b id="v-asgMax"></b></label><input type="range" min="2" max="60" data-r="asgMax" />
                <p class="lab__note" id="v-asg-note"></p></div></div>
            <div data-only="lambda">
              <label class="lab__row"><span>Memory (RAM → CPU)</span></label>
              <select data-s="lambdaMem" data-num>${LAMBDA_MEM.map((v) => opt(v, memLabel(v))).join('')}</select>
              <label class="lab__row"><span>Timeout</span></label>
              <select data-s="lambdaTimeout" data-num>${LAMBDA_TIMEOUT.map((v) => opt(v, `${secs(v)}${v === 3 ? ' (default)' : v === 29 ? ' (API Gateway max)' : v === 900 ? ' (maximum)' : ''}`)).join('')}</select>
              <label class="lab__row"><span>Architecture</span></label>
              ${seg('lambdaArch', [['x86', 'x86_64'], ['arm', 'arm64 · Graviton']])}
              <label class="lab__row" for="n-lambdaFns"><span>Functions (1–${MAX_FNS.toLocaleString()})</span>
                <input type="number" class="lab__num" id="n-lambdaFns" min="1" max="${MAX_FNS}" step="1" inputmode="numeric" /></label>
              <input type="range" min="0" max="1000" id="r-lambdaFns" aria-label="Number of Lambda functions" />
              <div class="lab__quick">${[1, 10, 100, 1000, 10000].map((v) => `<button type="button" data-fns="${v}">${fmt(v)}</button>`).join('')}</div>
              <label class="lab__row"><span>Provisioned concurrency</span></label>
              <select data-s="lambdaPC" data-num>${LAMBDA_PC.map((v) => opt(v, v ? `${v.toLocaleString()} warm environments` : 'None (on-demand, cold starts)')).join('')}</select>
              <label class="lab__row"><span>Concurrency quota (per region)</span></label>
              <select data-s="lambdaConc" data-num>${LAMBDA_CONC.map((v) => opt(v, `${v.toLocaleString()}${v === 1000 ? ' (default quota)' : ''}`)).join('')}</select></div></div>

          <div class="lab__sec"><span class="eyebrow">Data</span>
            <label class="lab__row"><span>RDS instance</span></label><select data-s="rdsType">${Object.keys(RDS).map((k) => opt(k, `${k} — $${RDS[k][1]}/hr`)).join('')}</select>
            ${tog('multiAz', 'Multi-AZ', 'Standby in a second AZ, automatic failover')}
            <label class="lab__row"><span>Read replicas</span><b id="v-replicas"></b></label><input type="range" min="0" max="5" data-r="replicas" />
            ${tog('cache', 'Amazon ElastiCache (Redis)', 'Serves ~85% of reads from memory')}
            <div class="lab__sub" data-show="cache"><select data-s="cacheType">${Object.keys(CACHE).map((k) => opt(k, `${k} — $${CACHE[k][0]}/hr`)).join('')}</select></div></div>

          <div class="lab__sec"><span class="eyebrow">Async</span>
            ${tog('sqs', 'Amazon SQS + Lambda worker', 'Moves slow work (email, images) off the request path')}</div>
        </section>
        <section class="card stage lab__stage" id="lab-stage"><div class="stage__canvas" id="lab-canvas"></div>
          <div class="zoom" role="toolbar" aria-label="Diagram zoom">
            <button class="zoom__btn" data-zoom="out" title="Zoom out (−)" aria-label="Zoom out"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
            <button class="zoom__pct" data-zoom="reset" title="Fit to screen (0)" id="zoom-pct">100%</button>
            <button class="zoom__btn" data-zoom="in" title="Zoom in (+)" aria-label="Zoom in"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M12 5v14"/></svg></button>
            <span class="zoom__sep"></span>
            <button class="zoom__btn" data-zoom="fit" title="Fit to screen (0)" aria-label="Fit to screen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg></button>
            <button class="zoom__btn" data-zoom="full" title="Full screen" aria-label="Full screen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg></button>
          </div>
          <div class="zoom__hint" id="zoom-hint">Drag to pan · ${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} + scroll or pinch to zoom · double-click to zoom in</div>
          <div class="stage__legend"><span><i class="lg lg--req"></i>request</span><span><i class="lg lg--res"></i>response</span><span><i class="lg lg--hit"></i>cache / CDN hit</span><span><i class="lg lg--msg"></i>message / replication</span><span><i class="lg lg--err"></i>blocked / failed</span></div></section>
        <section class="card lab__out"><span class="eyebrow" id="lab-when">Results at peak</span><div class="metrics" id="lab-metrics"></div><div id="lab-advice"></div></section>
      </div>
      <section class="card day">
        <div class="day__head"><div><span class="eyebrow">A day of traffic</span><h3 id="day-title">Daily peak</h3></div>
          <div class="lab__actions"><button class="btn" id="day-peak">Peak</button><button class="btn btn--primary" id="day-play">▶ Play 24 h</button></div></div>
        <div class="day__bars" id="day-bars" role="group" aria-label="Hours of the day">${DAY.map((v, h) => `<button class="day__bar" data-h="${h}" style="--h:${v}" title="${hh(h)}"><span></span><small>${h % 3 ? '' : h}</small></button>`).join('')}</div>
        <p class="lab__note">Bar height is traffic; colour is health at that hour (<b class="ok">ok</b> · <b class="warn">strained</b> · <b class="bad">failing</b>). Click an hour to inspect it.</p></section>
      <section class="card bom"><div class="bom__head"><div><span class="eyebrow">Estimated monthly bill</span><h3 id="bom-total"></h3></div>
        <p class="lab__note" id="bom-note"></p></div>
        <div class="bom__scroll"><table class="cs-table bom__table"><thead><tr><th>Service</th><th>Configuration</th><th>Pricing basis</th><th>$/month</th></tr></thead><tbody id="bom-body"></tbody></table></div></section>
      </div>
      <div id="print-report" aria-hidden="true"></div>
    </div>`;

    const $ = (q) => root.querySelector(q);
    const stage = new window.Stage($('#lab-canvas'));
    let m;
    // zoom & pan
    stage.enableZoom();
    const zoomBar = $('.zoom');
    stage.onZoom = (z) => {
      $('#zoom-pct').textContent = `${Math.round(z * 100)}%`;
      zoomBar.querySelector('[data-zoom="out"]').disabled = z <= window.Stage.MIN_ZOOM + 1e-6;
      zoomBar.querySelector('[data-zoom="in"]').disabled = z >= window.Stage.MAX_ZOOM - 1e-6;
      $('#zoom-hint').classList.add('is-gone');
    };
    zoomBar.onclick = (e) => {
      const b = e.target.closest('[data-zoom]');
      if (!b) return;
      const a = b.dataset.zoom;
      if (a === 'in') stage.setZoom(stage.zoom * 1.3);
      else if (a === 'out') stage.setZoom(stage.zoom / 1.3);
      else if (a === 'reset' || a === 'fit') stage.resetView();
      else if (a === 'full') document.fullscreenElement ? document.exitFullscreen() : $('#lab-stage').requestFullscreen?.();
    };
    setTimeout(() => $('#zoom-hint')?.classList.add('is-gone'), 6000);

    root.querySelectorAll('[data-r]').forEach((r) => { r.value = s[r.dataset.r]; r.oninput = () => { s[r.dataset.r] = +r.value; update(); }; });
    root.querySelectorAll('[data-s]').forEach((sel) => { sel.value = String(s[sel.dataset.s]); sel.onchange = () => { s[sel.dataset.s] = sel.hasAttribute('data-num') ? +sel.value : sel.value; update(); }; });
    root.querySelectorAll('[data-k]').forEach((c) => { c.checked = !!s[c.dataset.k]; c.onchange = () => { s[c.dataset.k] = c.checked; update(); }; });
    root.querySelectorAll('[data-seg]').forEach((b) => (b.onclick = () => { s[b.dataset.seg] = b.dataset.v; update(); }));
    // Lambda function count: type any number, drag the log slider, or pick a preset
    const fnsNum = $('#n-lambdaFns'), fnsRange = $('#r-lambdaFns');
    const setFns = (n) => { s.lambdaFns = clamp(Math.round(n), 1, MAX_FNS); update(); };
    fnsNum.oninput = () => { const v = +fnsNum.value; if (fnsNum.value !== '' && Number.isFinite(v) && v >= 1) setFns(v); };
    fnsNum.onchange = () => { fnsNum.value = s.lambdaFns; };
    fnsRange.oninput = () => setFns(sliderToFns(+fnsRange.value));
    root.querySelectorAll('[data-fns]').forEach((b) => (b.onclick = () => setFns(+b.dataset.fns)));
    // provider tabs
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-prov]');
      if (!b) return;
      const p = b.dataset.prov;
      store.set('labProvider', p);
      root.querySelectorAll('.prov__tab').forEach((t) => { const on = t.dataset.prov === p; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on); });
      const aws = p === 'aws';
      $('#prov-aws').hidden = !aws;
      $('.lab__head').hidden = !aws;
      $('#prov-soon').innerHTML = aws ? '' : soonPanel(p);
      stop();
      stage.paused = !aws;
      if (aws) update();
    });
    stage.paused = prov !== 'aws';
    $('#lab-reset').onclick = () => { stop(); store.set('awslab', {}); awsLab(root); };
    $('#lab-pdf').onclick = () => exportPdf(root, s, m, stage);

    // ---- day playback ----
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      $('#day-play').textContent = '▶ Play 24 h';
    }
    $('#day-play').onclick = () => {
      if (timer) { stop(); update(); return; }
      hour = hour == null || hour >= 23 ? 0 : hour;
      $('#day-play').textContent = '❚❚ Pause';
      update(true);
      timer = setInterval(() => {
        if (!root.isConnected) return stop();
        if (hour >= 23) { stop(); hour = null; update(); return; }
        hour++;
        update(true);
      }, 700);
    };
    $('#day-peak').onclick = () => { stop(); hour = null; update(); };
    $('#day-bars').onclick = (e) => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      stop();
      hour = hour === +b.dataset.h ? null : +b.dataset.h;
      update();
    };

    function update(live = false) {
      store.set('awslab', s);
      const regs = regionList(s.region, s.regions);
      $('#v-users').textContent = fmt(USERS[s.users]);
      $('#v-ec2Count').textContent = s.ec2Count;
      $('#v-ecsTasks').textContent = s.ecsTasks;
      $('#v-replicas').textContent = s.replicas;
      if (document.activeElement !== fnsNum) fnsNum.value = s.lambdaFns;
      if (document.activeElement !== fnsRange) fnsRange.value = fnsToSlider(s.lambdaFns);
      root.querySelectorAll('[data-fns]').forEach((b) => b.classList.toggle('is-on', +b.dataset.fns === s.lambdaFns));
      $('#v-asgMax').textContent = Math.max(s.asgMax, s.compute === 'ecs' ? s.ecsTasks : s.ec2Count);
      $('#v-regions').textContent = s.regions;
      $('#v-region-list').innerHTML = s.regions > 1 ? `Active-active: ${regs.map((r, i) => `<b>${r}</b>${i ? '' : ' (primary, writes)'}`).join(' · ')}. Route 53 sends each user to the nearest one.` : `Everything runs in <b>${s.region}</b> (${REGIONS[s.region][0]}).`;
      $('#t-ec2Count').textContent = s.autoscale && s.alb ? 'Minimum instances' : 'Instances';
      $('#t-ecsTasks').textContent = s.autoscale && s.alb ? 'Minimum tasks' : 'Running tasks';
      $('#v-asg-note').textContent = s.alb ? 'Scales between the minimum above and this maximum.' : 'Needs the Application Load Balancer to spread traffic across new capacity.';
      root.querySelectorAll('[data-seg]').forEach((b) => { const on = s[b.dataset.seg] === b.dataset.v; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
      root.querySelectorAll('[data-only]').forEach((d) => (d.hidden = !d.dataset.only.split(' ').includes(s.compute)));
      root.querySelectorAll('[data-show]').forEach((d) => (d.hidden = !s[d.dataset.show]));

      const spike = s.spike ? 5 : 1;
      const f = (hour == null ? 1 : DAY[hour]) * spike;
      m = model(s, f);
      const when = hour == null ? `Results at daily peak${s.spike ? ' + 5× spike' : ''}` : `Results at ${hh(hour)} · ${Math.round(DAY[hour] * 100)}% of peak${s.spike ? ' × 5' : ''}`;
      $('#lab-when').textContent = when;
      $('#day-title').textContent = hour == null ? 'Daily peak' : `${hh(hour)}${timer ? ' — playing' : ''}`;

      const cls = (bad, good) => (bad ? 'is-bad' : good ? 'is-good' : '');
      const cu = Math.min(999, Math.round(m.computeUtil * 100));
      const lambda = s.compute === 'lambda';
      const cells = [
        ['req', 'Peak req/s', fmt(m.peak), ''],
        ['cpu', lambda ? 'Concurrency' : 'Compute CPU', lambda ? `${fmt(m.conc)}` : `${cu}%`, cls(m.computeUtil > 0.85, m.computeUtil < 0.6)],
        ['units', lambda ? 'Cold starts' : s.compute === 'ec2' ? 'Instances' : 'Tasks', lambda ? `${Math.round(m.coldShare * 100)}%` : `${m.instances}${m.R > 1 ? ` ×${m.R}` : ''}`, lambda ? cls(m.coldShare > 0.1, m.coldShare < 0.02) : ''],
        ['db', 'RDS load', `${Math.min(999, Math.round(m.dbUtil * 100))}%`, cls(m.dbUtil > 0.85, m.dbUtil < 0.6)],
        ['p95', 'p95 latency', m.p95 >= 1500 ? `${(m.p95 / 1000).toFixed(1)} s` : `${m.p95} ms`, cls(m.p95 > 500, m.p95 < 200)],
        ['err', 'Errors', `${(m.errors * 100).toFixed(m.errors ? 1 : 0)}%`, cls(m.errors > 0.01, m.errors === 0)],
        ['av', 'Availability', `${m.avail.toFixed(m.avail >= 99.995 ? 4 : 2)}%`, cls(m.avail < 99.5, m.avail >= 99.9)],
        ['reg', 'Regions', `${m.R}`, m.R > 1 ? 'is-good' : ''],
        ['cost', 'Monthly cost', usd(m.total), ''],
        ['cpm', 'Cost / 1M req', usd((m.total / m.monthReq) * 1e6), ''],
      ];
      $('#lab-metrics').innerHTML = cells.map(([id, k, v, c]) => `<div class="metric ${c}${!live && prev[id] != null && prev[id] !== v ? ' flash' : ''}"><small>${k}</small><b>${v}</b></div>`).join('');
      cells.forEach(([id, , v]) => (prev[id] = v));

      const title = { warn: 'Bottleneck', tip: 'Suggestion', next: 'Looking good' };
      $('#lab-advice').innerHTML = advice(s, m).slice(0, 3).map(([k, t]) => `<div class="callout callout--${k}"><div><span class="callout__title">${title[k]}</span>${t}</div></div>`).join('');

      // 24 h strip: health at every hour
      root.querySelectorAll('.day__bar').forEach((b) => {
        const h = +b.dataset.h;
        b.dataset.state = health(model(s, DAY[h] * spike));
        b.classList.toggle('is-on', h === hour);
      });

      $('#bom-total').textContent = `${usd(m.total)} / month`;
      $('#bom-note').textContent = `Approximate on-demand list prices (USD) for ${regs.join(', ')}${regs.some((r) => REGIONS[r][1] !== 1) ? ', scaled from us-east-1' : ''}. Excludes free tier, Savings Plans, taxes and support. Verify with the AWS Pricing Calculator.`;
      $('#bom-body').innerHTML = m.bill.map((b) => `<tr><td><b>${b.svc}</b></td><td>${b.cfg}</td><td>${b.basis}</td><td>${usd(b.cost)}</td></tr>`).join('') + `<tr class="bom__total"><td colspan="3"><b>Total</b></td><td>${usd(m.total)}</td></tr>`;
      stage.setScene(scene(s, m), { keepDots: live });
    }
    update();
    return { destroy() { stop(); stage.paused = true; } };
  }

  // =============================== PDF EXPORT ===============================
  function exportPdf(root, s, m, stage) {
    const rep = root.querySelector('#print-report');
    const svg = stage.svg.cloneNode(true);
    svg.querySelector('.dots')?.remove();
    // freeze any fade-in that is still running so the printed diagram is complete
    svg.querySelectorAll('.ent').forEach((g) => { g.style.transition = 'none'; if (g.style.opacity === '0') g.style.opacity = '1'; });
    svg.setAttribute('viewBox', stage.vbTarget.map((v) => v.toFixed(1)).join(' '));
    svg.removeAttribute('aria-hidden');
    const asg = s.autoscale && s.alb;
    const compute = s.compute === 'ec2' ? `EC2 · ${asg ? `${s.ec2Count}–${Math.max(s.ec2Count, s.asgMax)} (Auto Scaling)` : s.ec2Count} × ${s.ec2Type}`
      : s.compute === 'ecs' ? `ECS Fargate · ${asg ? `${s.ecsTasks}–${Math.max(s.ecsTasks, s.asgMax)} tasks (Auto Scaling)` : `${s.ecsTasks} tasks`} × ${s.ecsSize} · images in ECR`
      : `AWS Lambda · ${s.lambdaFns.toLocaleString()} function(s) · ${s.lambdaMem} MB · ${s.lambdaArch === 'arm' ? 'arm64' : 'x86_64'} · timeout ${secs(s.lambdaTimeout)} · ${s.lambdaPC ? `${s.lambdaPC} provisioned · ` : ''}quota ${s.lambdaConc.toLocaleString()}/region`;
    const edge = [m.R > 1 && 'Route 53 latency routing', s.cloudfront && 'CloudFront', s.s3 && 'S3', s.waf && 'AWS WAF (rate-based rule)', s.apigw && `API Gateway (${s.apigwType === 'http' ? 'HTTP' : 'REST'} API)`, s.alb && 'Application Load Balancer'].filter(Boolean).join(' · ') || 'None';
    const data = `RDS ${s.rdsType}${s.multiAz ? ' Multi-AZ' : ' Single-AZ'}${s.replicas ? ` + ${s.replicas} read replica(s)` : ''}${m.R > 1 ? ` + cross-region replicas` : ''}${s.cache ? ` · ElastiCache ${s.cacheType}` : ''}`;
    const date = new Date();
    rep.innerHTML = `
      <header class="pr__head"><div><div class="pr__eyebrow">AWS architecture report</div><h1>System design estimate</h1></div>
        <div class="pr__date">${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}<br>${m.regs.join(' · ')} · on-demand</div></header>
      <section class="pr__grid">
        <div><h2>Workload</h2><table class="cs-table">
          <tr><td>Daily active users</td><td>${fmt(m.users)}</td></tr>
          <tr><td>Requests / user / day</td><td>${s.reqPerUser}</td></tr>
          <tr><td>Requests / month</td><td>${fmt(m.monthReq)}</td></tr>
          <tr><td>Peak requests / s</td><td>${fmt(m.peak)}${s.spike ? ' (5× spike)' : ''}</td></tr></table></div>
        <div><h2>Results at peak</h2><table class="cs-table">
          <tr><td>p95 latency</td><td>${m.p95 >= 1500 ? (m.p95 / 1000).toFixed(1) + ' s' : m.p95 + ' ms'}</td></tr>
          <tr><td>Error rate</td><td>${(m.errors * 100).toFixed(1)}%</td></tr>
          <tr><td>Availability (SLA chain)</td><td>${m.avail.toFixed(3)}%</td></tr>
          <tr><td>${s.compute === 'lambda' ? 'Lambda concurrency / region' : 'Compute utilisation'}</td><td>${s.compute === 'lambda' ? fmt(m.conc) : Math.round(m.computeUtil * 100) + '%'}</td></tr>
          <tr><td>RDS utilisation</td><td>${Math.round(m.dbUtil * 100)}%</td></tr></table></div>
      </section>
      <h2>Architecture</h2>
      <div class="pr__diagram"></div>
      <table class="cs-table pr__cfg">
        <tr><td>Regions</td><td>${m.regs.map((r) => `${r} (${REGIONS[r][0]})`).join(', ')}</td></tr>
        <tr><td>Edge & routing</td><td>${edge}</td></tr>
        <tr><td>Compute</td><td>${compute}</td></tr>
        <tr><td>Data</td><td>${data}</td></tr>
        <tr><td>Async</td><td>${s.sqs ? 'SQS queue + Lambda consumer' : 'None'}</td></tr></table>
      <h2>Estimated monthly cost — ${usd(m.total)}</h2>
      <table class="cs-table bom__table"><thead><tr><th>Service</th><th>Configuration</th><th>Pricing basis</th><th>$/month</th></tr></thead>
        <tbody>${m.bill.map((b) => `<tr><td><b>${b.svc}</b></td><td>${b.cfg}</td><td>${b.basis}</td><td>${usd(b.cost)}</td></tr>`).join('')}
        <tr class="bom__total"><td colspan="3"><b>Total</b></td><td>${usd(m.total)}</td></tr></tbody></table>
      <h2>Recommendations</h2>
      <ul class="pr__list">${advice(s, m).map(([, t]) => `<li>${t}</li>`).join('')}</ul>
      <p class="pr__foot">Assumptions: ${s.reqPerUser} requests per user per day, 3× peak factor, 40% static content, 90/10 read/write mix, 85% cache hit rate, writes go to the primary region. Prices are approximate AWS list prices; regions other than us-east-1 are scaled by an approximate multiplier. Excludes free tier, Savings Plans, Reserved Instances, taxes and support. Validate with the AWS Pricing Calculator before budgeting.</p>`;
    rep.querySelector('.pr__diagram').appendChild(svg);

    // print in light theme, name the file sensibly
    const html = document.documentElement;
    const prevTheme = html.dataset.theme;
    const prevTitle = document.title;
    html.dataset.theme = 'light';
    document.title = `aws-architecture-${date.toISOString().slice(0, 10)}`;
    const restore = () => { html.dataset.theme = prevTheme || 'light'; document.title = prevTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setTimeout(() => window.print(), 50);
  }

  window.awsLab = awsLab;
})();
