/**
 * cache — what each athlete tab showed last time, kept on the phone.
 *
 * Every tab used to open on a fresh query, so the first visit to each one in a
 * session waited on the network: measured on wifi, ~350ms on Home, ~400ms on
 * Fines and ~450ms on Schedule, several times that on 4G. Now a tab draws what
 * it showed last time on its very first frame and refreshes underneath — the
 * way Messages or Instagram open. Only the first launch after install still
 * waits, and `Reveal` covers that.
 *
 * **Read synchronously.** Everything is pulled into memory once at launch, and
 * AuthContext waits on `cacheReady` before it hands over the profile, so a
 * section can seed its initial `useState` from here and has no loading frame.
 *
 * **Per user, and cleared on sign-out.** Two people sharing a phone must never
 * see each other's squad.
 *
 * Bump `VERSION` whenever a cached shape changes; older entries are dropped on
 * the next launch instead of being fed to code that no longer expects them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROOT = 'athlink:cache:';
const VERSION = 'v1';
const PREFIX = `${ROOT}${VERSION}:`;

const memory = new Map<string, unknown>();

const keyFor = (userId: string, name: string) => `${PREFIX}${userId}:${name}`;

export const cacheReady: Promise<void> = (async () => {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(ROOT));
    const stale = keys.filter(k => !k.startsWith(PREFIX));
    if (stale.length) void AsyncStorage.multiRemove(stale).catch(() => {});

    const pairs = await AsyncStorage.multiGet(keys.filter(k => k.startsWith(PREFIX)));
    for (const [k, v] of pairs) {
      if (v) memory.set(k, JSON.parse(v));
    }
  } catch {
    // A cache that fails to load is an empty cache. Never worth an error.
  }
})();

export function readCache<T>(userId: string, name: string): T | undefined {
  return memory.get(keyFor(userId, name)) as T | undefined;
}

/** Fire-and-forget: memory updates now, the disk catches up. */
export function writeCache(userId: string, name: string, value: unknown): void {
  const key = keyFor(userId, name);
  memory.set(key, value);
  void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

export async function clearCache(): Promise<void> {
  memory.clear();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(ROOT));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // Nothing useful to do; the next sign-in is keyed by its own user id anyway.
  }
}
