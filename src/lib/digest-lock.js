let digestLock = Promise.resolve();

export function withDigestLock(fn) {
    // Chain calls so that the next call waits for previous to finish
    const next = digestLock.then(() => fn());
    // Ensure lock proceeds even if fn rejects
    digestLock = next.catch(() => {}).then(() => {});
    return next;
}

export function resetDigestLock() {
    digestLock = Promise.resolve();
}
