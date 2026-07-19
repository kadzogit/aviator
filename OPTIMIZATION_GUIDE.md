# Aviator Game - Firebase/Firestore Optimization Guide

## Overview

This document outlines the optimization strategies implemented to minimize Firestore reads and writes while maintaining real-time game functionality on the Blaze plan.

## Key Optimization Strategies

### 1. Stuck Phase Detection & Recovery

**Problem:** If the host disconnects during the 3-second "crashed" delay, the game gets stuck in the crashed or flying state forever.

**Solution:** Implemented automatic stuck phase detection that runs every 2 seconds and checks if any phase has lasted longer than 8 seconds. If detected, the system automatically recovers by transitioning to the next phase.

**Files Modified:**
- `frontend/src/hooks/game/firebaseGame.js` - Added `startStuckPhaseDetector()` and `stopStuckPhaseDetector()`
- `frontend/src/hooks/useGame.js` - Integrated detector into game lifecycle

**Result:** Prevents indefinite stuck states. Game automatically recovers within 8 seconds.

### 2. Listener Consolidation

**Problem:** Multiple simultaneous Firestore listeners consume quota quickly.

**Solution:**
- **Live Data:** Only `gameState/current` and `bets` (current round) use real-time listeners
- **Historical Data:** Previous bets, top wins, and user history use manual refresh with buttons
- **Admin Data:** All non-critical admin data (users, transactions, logs) uses manual refresh instead of continuous listeners

**Firestore Operations Reduced:**
- Eliminated persistent listeners on: `users`, `transactions`, `adminLogs`, `rounds` (history)
- Replaced with on-demand `getDocs()` calls with refresh buttons

**Files Modified:**
- `frontend/src/components/LeftPanelOptimized.jsx` - Added refresh buttons for Previous Bets and Top Wins
- `admin/AdminDashboard.jsx` - All data tabs have manual refresh buttons

### 3. Batched Writes

**Problem:** Writing every multiplier change or bet update creates excessive writes.

**Solution:** Implemented batching utilities that queue updates and flush them in batches every 2 seconds instead of immediately.

**Files:**
- `frontend/src/hooks/game/firebaseOptimization.js` - Contains `createBatchedWriter()`, `createDebouncedWriter()`, and `createBetWriter()`

**Usage Example:**
```javascript
const writer = createBatchedWriter(2000); // Flush every 2 seconds
writer.queue("multiplier", 3.45);
writer.queue("activePlayers", 5);
await writer.forceFlush(); // Manual flush when needed
```

### 4. Local Caching

**Problem:** Repeated reads of the same data (user profile, game settings) waste quota.

**Solution:** Implemented a simple TTL-based cache that stores frequently-read data locally for 60 seconds before requiring a fresh read.

**Files:**
- `frontend/src/hooks/game/firebaseOptimization.js` - `createLocalCache(ttlMs)`

### 5. Lazy Loading

**Problem:** Loading all user data on app startup is wasteful.

**Solution:** Load user data only when needed (e.g., when viewing a specific user's profile).

**Files:**
- `frontend/src/hooks/game/firebaseOptimization.js` - `lazyLoadUserData()`

## Firestore Quota Impact

### Before Optimization

**Estimated Daily Reads/Writes (100 active users, 50 rounds/day):**
- Game state listener: 100 users × 50 rounds × 2 updates/round = 10,000 reads
- Bets listener: 100 users × 50 rounds × 5 bets/round = 25,000 reads
- Admin listeners: 5 admins × 4 listeners × 1,000 updates/day = 20,000 reads
- User profile reads: 100 users × 10 reads/day = 1,000 reads
- **Total: ~56,000 reads/writes per day**

### After Optimization

**Estimated Daily Reads/Writes:**
- Game state listener: 100 users × 50 rounds × 2 updates/round = 10,000 reads (unchanged)
- Bets listener: 100 users × 50 rounds × 5 bets/round = 25,000 reads (unchanged)
- Admin manual refresh: 5 admins × 4 refreshes/day × 50 docs = 1,000 reads (was 20,000)
- User profile reads: 100 users × 2 reads/day (cached) = 200 reads (was 1,000)
- Batched writes: 50 rounds × 1 batch/round = 50 writes (was 500)
- **Total: ~36,250 reads/writes per day**

**Savings: ~35% reduction in quota usage**

## Implementation Checklist

- [x] Stuck phase detection and recovery
- [x] Admin dashboard with manual refresh buttons
- [x] Optimized LeftPanel with refresh buttons
- [x] Firebase optimization utilities library
- [x] Consolidated listeners (only gameState and current bets are live)
- [ ] Implement batched writes in bettingEngine
- [ ] Implement local caching in useGame hook
- [ ] Monitor actual quota usage and adjust thresholds

## Monitoring & Adjustment

### Enable Usage Monitoring

```javascript
import { createUsageMonitor } from "./hooks/game/firebaseOptimization";

const monitor = createUsageMonitor();

// Log usage periodically
setInterval(() => {
  const stats = monitor.getStats();
  console.log("Firestore Usage:", stats);
}, 60000);
```

### Adjust Thresholds

If quota usage is still high, adjust these constants:

1. **Stuck Phase Timeout** (`firebaseGame.js`):
   - Current: 8000ms
   - Reduce to 5000ms for faster recovery (more aggressive)
   - Increase to 10000ms for slower networks (more conservative)

2. **Batch Flush Interval** (`firebaseOptimization.js`):
   - Current: 2000ms
   - Increase to 5000ms for fewer writes (less responsive)
   - Decrease to 1000ms for more responsive updates (more writes)

3. **Cache TTL** (`firebaseOptimization.js`):
   - Current: 60000ms (1 minute)
   - Increase for stale data tolerance
   - Decrease for fresher data (more reads)

## Best Practices

1. **Always use manual refresh for non-critical data** - Admin panels, historical data, user lists
2. **Batch related updates together** - Don't write multiplier and player count separately
3. **Use local state for UI updates** - Only sync to Firestore when necessary
4. **Implement debouncing for rapid changes** - Prevent write storms during fast multiplier changes
5. **Monitor quota usage regularly** - Set up alerts for unusual spikes

## Firestore Rules for Efficiency

Ensure your Firestore security rules prevent unauthorized writes:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only host can write to gameState
    match /gameState/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == resource.data.hostUid;
    }

    // Only users can write their own bets
    match /bets/{document=**} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.uid;
      allow update: if request.auth.uid == resource.data.uid;
    }

    // Only admins can write to admin logs
    match /adminLogs/{document=**} {
      allow read: if request.auth.token.role in ["admin", "superadmin"];
      allow write: if request.auth.token.role in ["admin", "superadmin"];
    }
  }
}
```

## Next Steps

1. Deploy optimized code to production
2. Monitor Firestore usage for 1 week
3. Adjust thresholds based on actual usage patterns
4. Implement additional caching if needed
5. Consider Firestore composite indexes for frequently-queried data
