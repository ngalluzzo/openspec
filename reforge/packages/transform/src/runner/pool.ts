/**
 * Run tasks with bounded concurrency.
 *
 * No classes, no external deps. Takes an array of thunks and
 * a concurrency limit, runs them in parallel up to that limit,
 * collects results in order.
 */
export async function pool<T>(
	tasks: Array<() => Promise<T>>,
	concurrency: number,
): Promise<T[]> {
	if (tasks.length === 0) return [];
	if (concurrency <= 0)
		throw new RangeError(`concurrency must be > 0, got ${concurrency}`);

	const results: T[] = new Array(tasks.length);
	let nextIdx = 0;

	async function worker(): Promise<void> {
		while (nextIdx < tasks.length) {
			const idx = nextIdx++;
			const task = tasks[idx];
			if (task == null) continue;
			results[idx] = await task();
		}
	}

	const workers = Array.from(
		{ length: Math.min(concurrency, tasks.length) },
		() => worker(),
	);

	await Promise.all(workers);
	return results;
}
