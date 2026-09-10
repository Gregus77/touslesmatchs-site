"""Static gate for the public guides; never writes or deploys website files."""
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2] / 'public'
ORIGIN = 'https://www.touslesmatchs.com'
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.stack, self.ids, self.links = path, [], [], []
        self.h1 = 0
        self.canonical = []
        self.json_text = None
        self.feed(path.read_text())
        assert not self.stack, (path, self.stack)
        assert not self.json_text, path
        assert self.h1 == 1, path
        assert len(self.ids) == len(set(self.ids)), path

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in VOID:
            self.stack.append(tag)
        if 'id' in a:
            self.ids.append(a['id'])
        self.h1 += tag == 'h1'
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical.append(a['href'])
        for key in ['href', 'src']:
            if key in a:
                self.links.append(a[key])
        assert not any(k.startswith('on') for k in a), (self.path, 'inline handler')
        if tag == 'script':
            assert a.get('type') == 'application/ld+json' and 'src' not in a, self.path
            self.json_text = ''

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        assert self.stack and self.stack.pop() == tag, (self.path, tag)
        if tag == 'script':
            json.loads(self.json_text)
            self.json_text = None

    def handle_data(self, data):
        if self.json_text is not None:
            self.json_text += data


def resolve(path):
    target = ROOT / unquote(path).lstrip('/')
    assert target.resolve().is_relative_to(ROOT.resolve()), path
    choices = [target / 'index.html', target, Path(str(target) + '.html')]
    return next((p for p in choices if p.is_file()), None)


pages = {p: Page(p) for p in sorted((ROOT / 'guides').rglob('index.html'))}
assert len(pages) >= 2, 'Missing guide collection'
locations = [n.text for n in ET.parse(ROOT / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
assert not [u for u, n in Counter(locations).items() if n > 1], 'Duplicate sitemap URL'
hub = pages[ROOT / 'guides/index.html']
for path, page in pages.items():
    route = '/' + str(path.parent.relative_to(ROOT)) + '/'
    assert page.canonical == [ORIGIN + route], (path, 'canonical')
    assert locations.count(ORIGIN + route) == 1, (path, 'sitemap')
    if route != '/guides/':
        assert route in hub.links, (path, 'missing hub link')
    for link in page.links:
        u = urlsplit(link)
        assert u.scheme in ('', 'https'), (path, link)
        if u.netloc and u.netloc != 'www.touslesmatchs.com':
            continue
        target = resolve(u.path) if u.path else path
        assert target, (path, 'missing target', link)
        if u.fragment:
            text = target.read_text()
            assert re.search(r'''id=["']''' + re.escape(u.fragment) + r'''["']''', text), (path, 'missing anchor', link)
    assert '18+' in path.read_text() and 'Aucun gain garanti' in path.read_text(), path
for asset in re.findall(r"url\(['\"]?([^)'\"]+)", (ROOT / 'css/guides.css').read_text()):
    assert resolve(urlsplit(asset).path), ('missing CSS asset', asset)
print(f'PASS: {len(pages)} pages, HTML, canonical, sitemap, internal links and anchors, CSS assets.')
