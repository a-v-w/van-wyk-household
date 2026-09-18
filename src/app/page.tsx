import { db } from "@/db";

export const dynamic = "force-dynamic";

async function loadHouseholds() {
  try {
    return { households: await db.query.households.findMany(), error: null };
  } catch (error) {
    return {
      households: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function Home() {
  const { households, error } = await loadHouseholds();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">van Wyk household</h1>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Database
        </h2>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Not reachable: {error}
          </p>
        ) : households.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Connected. No households yet.
          </p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {households.map((h) => (
              <li key={h.id}>{h.name}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
