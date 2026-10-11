// Tiny storage layer: Firestore in production, an in-memory map for tests and local dev.
// Everything is built on transaction(fn) so both back-ends behave the same.

export function makeStore(kind = process.env.STORE || 'firestore') {
  return kind === 'memory' ? memoryStore() : firestoreStore();
}

function memoryStore() {
  const data = new Map();
  let chain = Promise.resolve();
  const key = (c, i) => `${c}/${i}`;
  return {
    kind: 'memory',
    async get(c, i) { const v = data.get(key(c, i)); return v ? structuredClone(v) : null; },
    transaction(fn) {
      const run = chain.then(() => fn({
        get: async (c, i) => { const v = data.get(key(c, i)); return v ? structuredClone(v) : null; },
        set: (c, i, d) => data.set(key(c, i), {...(data.get(key(c, i)) || {}), ...structuredClone(d)})
      }));
      chain = run.catch(() => {});
      return run;
    },
    _dump: () => data
  };
}

function firestoreStore() {
  let db;
  const lazy = async () => {
    if (!db) { const {Firestore} = await import('@google-cloud/firestore'); db = new Firestore({ignoreUndefinedProperties: true}); }
    return db;
  };
  return {
    kind: 'firestore',
    async get(c, i) { const d = await (await lazy()).collection(c).doc(i).get(); return d.exists ? d.data() : null; },
    async transaction(fn) {
      const fs = await lazy();
      return fs.runTransaction(async t => fn({
        get: async (c, i) => { const d = await t.get(fs.collection(c).doc(i)); return d.exists ? d.data() : null; },
        set: (c, i, d) => t.set(fs.collection(c).doc(i), d, {merge: true})
      }));
    }
  };
}

// Count-limited counter (daily quotas). Returns {ok, count}.
export async function tryConsume(store, id, limit, ttlDays = 3) {
  return store.transaction(async tx => {
    const cur = (await tx.get('usage', id)) || {count: 0};
    if (cur.count >= limit) return {ok: false, count: cur.count};
    tx.set('usage', id, {count: cur.count + 1, expireAt: new Date(Date.now() + ttlDays * 86400000)});
    return {ok: true, count: cur.count + 1};
  });
}

export async function release(store, id) {
  return store.transaction(async tx => {
    const cur = await tx.get('usage', id);
    if (cur && cur.count > 0) tx.set('usage', id, {count: cur.count - 1});
  });
}
