/**
 * Firebase Optimization Strategies for Blaze Plan
 * 
 * This module provides optimization patterns to minimize Firestore reads/writes
 * while maintaining real-time game functionality.
 */

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

/**
 * Batch multiple updates into a single write operation
 * Instead of writing multiplier every tick, only write when significant changes occur
 */
export function createBatchedWriter(flushIntervalMs = 2000) {
  let pendingUpdates = {};
  let flushTimer = null;

  async function flush() {
    if (Object.keys(pendingUpdates).length === 0) return;

    try {
      const updates = { ...pendingUpdates, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "gameState", "current"), updates);
      console.log("[BatchedWriter] Flushed", Object.keys(updates).length, "updates");
      pendingUpdates = {};
    } catch (err) {
      console.error("[BatchedWriter] Flush failed:", err);
    }
  }

  function queue(key, value) {
    pendingUpdates[key] = value;

    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, flushIntervalMs);
  }

  function forceFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    return flush();
  }

  return { queue, forceFlush };
}

/**
 * Debounce rapid Firestore writes
 * Prevents excessive writes during fast multiplier changes
 */
export function createDebouncedWriter(delayMs = 500) {
  let timer = null;
  let lastValue = null;

  async function write(path, updates) {
    if (timer) clearTimeout(timer);

    timer = setTimeout(async () => {
      try {
        await updateDoc(doc(db, path.split("/")[0], path.split("/")[1]), updates);
        console.log("[DebouncedWriter] Wrote to", path);
      } catch (err) {
        console.error("[DebouncedWriter] Write failed:", err);
      }
      timer = null;
    }, delayMs);
  }

  return { write };
}

/**
 * Cache frequently-read data locally to reduce reads
 * Useful for user profiles, game settings, etc.
 */
export function createLocalCache(ttlMs = 60000) {
  const cache = new Map();

  function set(key, value) {
    cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  function get(key) {
    const entry = cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > ttlMs) {
      cache.delete(key);
      return null;
    }

    return entry.value;
  }

  function clear() {
    cache.clear();
  }

  return { set, get, clear };
}

/**
 * Lazy load data only when needed
 * Instead of loading all user data on mount, load on demand
 */
export async function lazyLoadUserData(uid, cache) {
  const cached = cache.get(`user_${uid}`);
  if (cached) return cached;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.data();
    cache.set(`user_${uid}`, data);
    return data;
  } catch (err) {
    console.error("[LazyLoad] Failed to load user:", err);
    return null;
  }
}

/**
 * Consolidate multiple listeners into a single listener with manual refresh
 * Reduces listener overhead for non-critical data
 */
export function createManualRefreshListener(collection, query) {
  let data = [];
  let lastRefresh = 0;
  const MIN_REFRESH_INTERVAL = 5000; // Min 5 seconds between refreshes

  async function refresh() {
    const now = Date.now();
    if (now - lastRefresh < MIN_REFRESH_INTERVAL) {
      console.warn("[ManualRefresh] Refresh throttled - too frequent");
      return data;
    }

    try {
      const snap = await getDocs(query);
      data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lastRefresh = now;
      console.log("[ManualRefresh] Refreshed", data.length, "documents");
      return data;
    } catch (err) {
      console.error("[ManualRefresh] Refresh failed:", err);
      return data;
    }
  }

  function getData() {
    return data;
  }

  return { refresh, getData };
}

/**
 * Optimize bet writes by batching and deduplicating
 * Only write bet updates when status actually changes
 */
export function createBetWriter() {
  const pendingBets = new Map();

  function queueBetUpdate(betId, updates) {
    const existing = pendingBets.get(betId) || {};
    pendingBets.set(betId, { ...existing, ...updates });
  }

  async function flushBets() {
    if (pendingBets.size === 0) return;

    const batch = [];
    for (const [betId, updates] of pendingBets.entries()) {
      batch.push(
        updateDoc(doc(db, "bets", betId), {
          ...updates,
          updatedAt: serverTimestamp(),
        })
      );
    }

    try {
      await Promise.all(batch);
      console.log("[BetWriter] Flushed", batch.length, "bet updates");
      pendingBets.clear();
    } catch (err) {
      console.error("[BetWriter] Flush failed:", err);
    }
  }

  return { queueBetUpdate, flushBets };
}

/**
 * Monitor and log Firestore usage for quota tracking
 */
export function createUsageMonitor() {
  let reads = 0;
  let writes = 0;
  let deletes = 0;

  function recordRead(count = 1) {
    reads += count;
    console.log(`[Usage] Reads: ${reads}, Writes: ${writes}, Deletes: ${deletes}`);
  }

  function recordWrite(count = 1) {
    writes += count;
    console.log(`[Usage] Reads: ${reads}, Writes: ${writes}, Deletes: ${deletes}`);
  }

  function recordDelete(count = 1) {
    deletes += count;
    console.log(`[Usage] Reads: ${reads}, Writes: ${writes}, Deletes: ${deletes}`);
  }

  function getStats() {
    return { reads, writes, deletes };
  }

  return { recordRead, recordWrite, recordDelete, getStats };
}
