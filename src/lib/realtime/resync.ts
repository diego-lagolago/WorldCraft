/** First `hello` is the initial connect; every later one is a reconnect (CR-006). */
export function nextHello(seenHello: boolean): { seenHello: true; resync: boolean } {
  return { seenHello: true, resync: seenHello };
}
