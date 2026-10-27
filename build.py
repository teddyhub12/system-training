"""Rebuilds index.html from the files in src/. Run: python3 build.py"""
from pathlib import Path
src = Path(__file__).parent / 'src'
page = (src / 'shell.html').read_text(encoding='utf-8')
page = page.replace('/*EPRCSS*/', (src / 'epr.css').read_text(encoding='utf-8'))
page = page.replace('/*SCENE*/', (src / 'scene.js').read_text(encoding='utf-8'))
page = page.replace('/*EPR*/', (src / 'epr.js').read_text(encoding='utf-8'))
page = page.replace('/*TRAIN*/', (src / 'train.js').read_text(encoding='utf-8'))
page = page.replace('__THREE__', 'vendor/three')   # three.js r147 is bundled, so no outside code host is needed
(Path(__file__).parent / 'index.html').write_text(page, encoding='utf-8')
print('index.html rebuilt')
