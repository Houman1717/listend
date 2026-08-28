import { useSyncExternalStore } from 'react';

// Tracks whether our backend (Supabase Data API / Railway) is actually
// answering, which is NOT the same as "is the phone online".
//
// During the Supabase incident on 2026-08-28 the device had full signal, so the
// connectivity banner never fired — every screen just silently rendered 0s and
// empty lists, which read as "all my data is gone". This module gives the app a
// single place to know "reads are failing right now" so it can say so.
//
// Deliberately tolerant: one failed request is normal (a flaky moment, a
// cancelled screen). Only a run of consecutive failures flips the state, and any
// single success clears it immediately.

const FAILURE_THRESHOLD = 3;

let consecutiveFailures = 0;
let unhealthy = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Call when a backend read/write fails (network error, 5xx, thrown). */
export function reportBackendFailure() {
  consecutiveFailures += 1;
  if (!unhealthy && consecutiveFailures >= FAILURE_THRESHOLD) {
    unhealthy = true;
    emit();
  }
}

/** Call when a backend read/write succeeds. Clears the unhealthy state. */
export function reportBackendSuccess() {
  consecutiveFailures = 0;
  if (unhealthy) {
    unhealthy = false;
    emit();
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return unhealthy;
}

/** true when the backend has failed repeatedly and we're showing saved data. */
export function useBackendUnhealthy(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
