"""Fetch and cache one NISAR GCOV crop: fetch_crop.py <region> <collection_short_name> <granule_id>"""
import sys, types, requests
sys.path.insert(0, 'processing')
import real_nisar as R
region, coll, gid = sys.argv[1:4]
it = requests.get(R.CMR_URL, params={'short_name': coll, 'granule_ur': gid}, timeout=60).json()['items'][0]
https = [x['URL'] for x in it['umm']['RelatedUrls']
         if x.get('Type') == 'GET DATA' and x['URL'].startswith('https') and x['URL'].endswith('.h5')][0]
c = R.load_crop(region, 'fetch', {'granule_id': gid, 'https_url': https, 'size_bytes': None},
                types.SimpleNamespace(download=False, refresh=False))
print('OK', gid, c['HH'].shape)
