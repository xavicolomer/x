"""Download the app's fonts (Latin subsets) from Google Fonts into src/fonts, with a fonts.css that points at them.
Run once; the build inlines them so the app needs no internet. Usage: python3 tools/fetch_fonts.py"""
import os, re, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'fonts')
CSS = ('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800'
       '&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'}
css = urllib.request.urlopen(urllib.request.Request(CSS, headers=UA)).read().decode()
blocks = re.findall(r'/\* ([\w-]+) \*/\s*(@font-face \{.*?\})', css, re.S)
out, files = [], {}
for subset, block in blocks:
    if subset not in ('latin', 'latin-ext'): continue
    url = re.search(r'url\((https://[^)]+\.woff2)\)', block).group(1)
    fam = re.search(r"font-family: '([^']+)'", block).group(1)
    if url not in files:
        name = f"{fam.lower().replace(' ', '-')}-{subset}-{len(files)}.woff2"
        files[url] = name
        with open(os.path.join(OUT, name), 'wb') as f: f.write(urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read())
    out.append(block.replace(url, files[url]))
with open(os.path.join(OUT, 'fonts.css'), 'w') as f: f.write('\n'.join(out) + '\n')
print(len(files), 'font files,', len(out), 'faces')
