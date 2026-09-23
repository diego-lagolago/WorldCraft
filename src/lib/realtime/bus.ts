/**
 * In-process realtime bus. One Node process only — see architecture/README.md.
 * A throwing listener is removed and does not stop the others (CR-007).
 */

type Listener<T> = (event: T) => void;

const globalForBus = globalThis as typeof globalThis & {
  __wcRealtimeBuses?: Map<string, Set<Listener<unknown>>>;
};

function registry(): Map<string, Set<Listener<unknown>>> {
  if (!globalForBus.__wcRealtimeBuses) {
    globalForBus.__wcRealtimeBuses = new Map();
  }
  return globalForBus.__wcRealtimeBuses;
}

function listeners<T>(key: string): Set<Listener<T>> {
  const map = registry();
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set as Set<Listener<T>>;
}

export function createRealtimeBus<T>(key: string) {
  return {
    publish(event: T): void {
      for (const listener of [...listeners<T>(key)]) {
        try {
          listener(event);
        } catch {
          listeners<T>(key).delete(listener);
        }
      }
    },
    subscribe(listener: Listener<T>): () => void {
      listeners<T>(key).add(listener);
      return () => {
        listeners<T>(key).delete(listener);
      };
    },
  };
}
