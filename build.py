"""Build public/index.html (single self-contained file) from src/, brand/ and media/."""
import base64, json, pathlib
from urllib.parse import quote
r = pathlib.Path(__file__).parent
html = (r/'src/index.html').read_text()
app = (r/'src/core.js').read_text() + '\n' + (r/'src/admin.js').read_text()
html = html.replace('/*QR*/', (r/'src/qrcode.js').read_text()).replace('/*APP*/', app.replace('</script', '<\\/script'))
html = html.replace('__VIDEO_B64__', base64.b64encode((r/'media/video480.mp4').read_bytes()).decode())
html = html.replace('__POSTER_B64__', base64.b64encode((r/'media/poster.jpg').read_bytes()).decode())
du = lambda f: 'data:image/svg+xml,' + quote((r/'brand'/f).read_text(), safe='')
html = html.replace('__SU_LOGO_WHITE__', du('su-logo-white.svg')).replace('__SU_LOGO__', du('su-logo.svg')).replace('__SU_FLAME__', du('su-flame.svg')).replace('__FAVICON__', du('su-flame.svg'))
html = html.replace('__SEED_VTT__', json.dumps((r/'brand/video1.vtt').read_text()))
(r/'public').mkdir(exist_ok=True); (r/'public/index.html').write_text(html)
print('public/index.html', round(len(html)/1e6, 1), 'MB')
