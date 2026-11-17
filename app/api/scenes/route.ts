import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AvailableScenesCatalog, RegionId } from '@/types/sar';

const BBOXES: Record<string, string> = {
  nagapattinam: '79.65,10.60,79.95,11.00',
  majuli: '93.95,26.80,94.45,27.15',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const region = (searchParams.get('region') || 'nagapattinam') as RegionId;
  const bbox = BBOXES[region] || BBOXES.nagapattinam;

  // 1. Try Live NASA CMR API with timeout
  try {
    const cmrUrl = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=NISAR_L2_GCOV_PROVISIONAL_V1&bounding_box=${bbox}&page_size=10&sort_key=-start_date`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(cmrUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const entries = data?.feed?.entry || [];
      if (entries.length > 0) {
        return NextResponse.json({
          status: 'live_cmr_connected',
          source: 'live_cmr',
          granule_count: entries.length,
          granules: entries,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch {
    // Fall back to the local catalog (public/data/available_scenes.json)
  }

  // 2. Fallback to cached catalog from public/data/available_scenes.json
  try {
    const catalogPath = path.join(process.cwd(), 'public', 'data', 'available_scenes.json');
    const content = await fs.readFile(catalogPath, 'utf-8');
    const catalog = JSON.parse(content) as AvailableScenesCatalog;
    const regionData = catalog.regions[region] || catalog.regions.nagapattinam;

    return NextResponse.json({
      status: 'cached_catalog',
      source: 'local_available_scenes_json',
      granule_count: regionData?.pairs?.length ?? 0,
      pairs: regionData?.pairs || [],
      region_meta: regionData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load scenes', details: String(err) },
      { status: 500 }
    );
  }
}

