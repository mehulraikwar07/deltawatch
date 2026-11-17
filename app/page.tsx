import fs from 'node:fs/promises';
import path from 'node:path';
import { DeltawatchDashboard } from '@/components/DeltawatchDashboard';
import type { AvailableScenesCatalog, SummaryMetrics, RegionId } from '@/types/sar';

const REGIONS: RegionId[] = ['nagapattinam', 'majuli'];

async function readJson<T>(file: string): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: JSON.parse(await fs.readFile(file, 'utf-8')) as T, error: null };
  } catch (err) {
    return { data: null, error: `${path.relative(process.cwd(), file)}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export default async function HomePage() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const processedDir = path.join(process.cwd(), 'public', 'processed');

  // The catalog is optional for rendering; summary metrics are required.
  const catalogRes = await readJson<AvailableScenesCatalog>(path.join(dataDir, 'available_scenes.json'));
  const catalog: AvailableScenesCatalog = catalogRes.data ?? {
    generated_at: '',
    description: 'available_scenes.json could not be read',
    regions: {},
  };

  const metricResults = await Promise.all(
    REGIONS.map((r) => readJson<SummaryMetrics>(path.join(processedDir, r, 'summary_metrics.json')))
  );
  const errors = metricResults.map((r) => r.error).filter((e): e is string => !!e);

  if (errors.length > 0) {
    return (
      <main className="w-full h-screen flex items-center justify-center bg-[#030712] p-6">
        <div className="max-w-xl space-y-3 text-sm text-white/80">
          <h1 className="text-base font-bold text-amber-300">Scene data could not be loaded</h1>
          <p>The processed outputs may be missing or still being written. Reload in a moment.</p>
          <ul className="list-disc pl-5 font-mono text-xs text-white/60 space-y-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  const metrics = Object.fromEntries(
    REGIONS.map((r, i) => [r, metricResults[i].data as SummaryMetrics])
  ) as Record<RegionId, SummaryMetrics>;

  return (
    <main className="w-full h-screen overflow-hidden">
      <DeltawatchDashboard initialCatalog={catalog} initialMetrics={metrics} />
    </main>
  );
}
