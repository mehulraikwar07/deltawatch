import fs from 'node:fs/promises';
import path from 'node:path';
import { DeltawatchDashboard } from '@/components/DeltawatchDashboard';
import type { AvailableScenesCatalog, SummaryMetrics, RegionId } from '@/types/sar';

export default async function DashboardPage() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const processedDir = path.join(process.cwd(), 'public', 'processed');

  // Load available scenes catalog
  const catalogPath = path.join(dataDir, 'available_scenes.json');
  const catalogContent = await fs.readFile(catalogPath, 'utf-8');
  const catalog = JSON.parse(catalogContent) as AvailableScenesCatalog;

  // Load summary metrics for both deltas
  const nagMetricsPath = path.join(processedDir, 'nagapattinam', 'summary_metrics.json');
  const nagMetricsContent = await fs.readFile(nagMetricsPath, 'utf-8');
  const nagMetrics = JSON.parse(nagMetricsContent) as SummaryMetrics;

  const majMetricsPath = path.join(processedDir, 'majuli', 'summary_metrics.json');
  const majMetricsContent = await fs.readFile(majMetricsPath, 'utf-8');
  const majMetrics = JSON.parse(majMetricsContent) as SummaryMetrics;

  const metrics: Record<RegionId, SummaryMetrics> = {
    nagapattinam: nagMetrics,
    majuli: majMetrics,
  };

  return (
    <main className="w-full h-screen overflow-hidden">
      <DeltawatchDashboard initialCatalog={catalog} initialMetrics={metrics} />
    </main>
  );
}
