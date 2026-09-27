"""Refresh the official national hotel-star snapshot; no API keys required."""
import argparse
import io
import json
from pathlib import Path
import urllib.request
import zipfile

SOURCE = 'https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Hotel-json.zip'
def snapshot(data):
    hotels = []
    for p in data['Hotels']:
        if p.get('HotelStars') not in (3, 4, 5) or p.get('ServiceStatus') != 1:
            continue
        lat, lng = p.get('PositionLat'), p.get('PositionLon')
        if not isinstance(lat, (float, int)) or not isinstance(lng, (float, int)) or not (21 <= lat <= 27 and 118 <= lng <= 123):
            continue
        a = p.get('PostalAddress') or {}
        hotels.append(dict(id=p['HotelID'], name=p['HotelName'], stars=p['HotelStars'], lat=lat, lng=lng,
                           address=''.join(a.get(k) or '' for k in ('City', 'Town', 'StreetAddress')),
                           website=p.get('WebsiteURL') or '', updated=p.get('UpdateTime')))
    if not hotels:
        raise ValueError('No qualified hotels; refusing to replace the previous snapshot')
    return dict(source='https://data.gov.tw/dataset/7780', download=SOURCE,
                license='政府資料開放授權條款第1版', updated=data['UpdateTime'], hotels=hotels)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', help='Use a downloaded HotelList.json instead of downloading')
    args = parser.parse_args()
    if args.input:
        data = json.loads(Path(args.input).read_text(encoding='utf-8-sig'))
    else:
        with urllib.request.urlopen(SOURCE, timeout=45) as response:
            archive = zipfile.ZipFile(io.BytesIO(response.read()))
            data = json.loads(archive.read('HotelList.json').decode('utf-8-sig'))
    result = snapshot(data)
    target = Path(__file__).resolve().parents[1] / 'worker' / 'hotel-stars.js'
    target.write_text('// Official Tourism Administration open data. Regenerate with scripts/update-hotels.py.\nexport const hotelStars = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'Updated {len(result["hotels"])} star-rated hotels; source date {result["updated"]}')
