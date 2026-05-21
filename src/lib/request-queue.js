export async function withConcurrencyLimit(items, worker, concurrency = 3) {
    const results = [];
    const executing = [];

    for (const item of items) {
        const p = Promise.resolve().then(() => worker(item));
        results.push(p);

        const e = p.then(() => {
            const idx = executing.indexOf(e);
            if (idx >= 0) executing.splice(idx, 1);
        }).catch(() => {
            const idx = executing.indexOf(e);
            if (idx >= 0) executing.splice(idx, 1);
        });

        executing.push(e);

        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}

export function chunkArray(array, size = 10) {
    const out = [];
    for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
    return out;
}
