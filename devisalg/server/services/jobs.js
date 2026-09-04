// Simple background job queue with retries and idempotency.
// Because AI/PDF/WhatsApp work should not block HTTP responses, we push jobs
// here and process them asynchronously. For scale-out, swap for Redis + BullMQ
// behind the same addJob() interface (job idempotency key prevents duplicates).

const jobs = [];
const processed = new Set(); // idempotency keys already handled
const active = new Set();
let running = false;

const HANDLERS = {};

function register(type, fn) {
  HANDLERS[type] = fn;
}

function addJob(type, data, { idempotencyKey, delay = 0 } = {}) {
  if (idempotencyKey) {
    if (processed.has(idempotencyKey)) return { ok: true, deduped: true };
    processed.add(idempotencyKey);
  }
  const job = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, data, idempotencyKey, delay, retries: 3, created: Date.now() };
  jobs.push(job);
  schedule();
  return { ok: true, id: job.id };
}

function schedule() {
  if (running) return;
  running = true;
  setTimeout(processNext, 10);
}

async function processNext() {
  running = true;
  if (jobs.length === 0) {
    running = false;
    return;
  }
  const job = jobs.shift();
  const fn = HANDLERS[job.type];
  if (!fn) {
    running = false;
    if (jobs.length) setTimeout(processNext, 10);
    else running = false;
    return;
  }
  if (job.delay && Date.now() < job.created + job.delay) {
    jobs.push(job);
    setTimeout(processNext, job.delay);
    return;
  }
  active.add(job.id);
  try {
    await fn(job.data);
  } catch (e) {
    console.error(`Job ${job.type} failed:`, e.message);
    if (job.retries > 0) {
      job.retries -= 1;
      job.delay = 1000 * (3 - job.retries);
      jobs.push(job);
    }
  } finally {
    active.delete(job.id);
    if (jobs.length) setTimeout(processNext, 10);
    else running = false;
  }
}

function stats() {
  return { pending: jobs.length, active: active.size };
}

module.exports = { addJob, register, stats };
