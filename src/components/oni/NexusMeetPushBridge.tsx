/**
 * Meet push delivery has a single source of truth: the successful admin
 * `meet.create` action. Keeping a second Firestore watcher here caused the
 * same Meet to be broadcast twice when an admin created it while the app was
 * open. The component remains mounted for backwards-compatible imports, but
 * intentionally performs no client-side broadcast.
 */
export function NexusMeetPushBridge() {
  return null;
}
