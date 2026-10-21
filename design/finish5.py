import re
exec(open('make5.py').read().split("pre = s[:s.index('<style>')]")[0])
mid = s[iend+len('</style>'):h0]
out = new_css + mid + body
out = re.sub(r"\n  'm1-[^\n]*", '', out)
out = re.sub(r"\n  'm3-[^\n]*", '', out)
a = out.index('function initDoor'); b = out.index('function initNight')
out = out[:a] + out[b:]
a = out.index('function initDirectory'); b = out.index('const inits =')
out = out[:a] + out[b:]
out = out.replace("const dirs = ['door', 'night', 'directory'];", "const dirs = ['cream', 'navy'];")
a = out.index('const inits ='); b = out.index("document.querySelectorAll('.tab').forEach")
new_show = '''function show(id) {
  if (mm) { mm.revert(); mm = null; }
  current = id;
  const root = document.getElementById('mock-main');
  root.classList.toggle('is-day', id === 'cream');
  dirs.forEach(d => {
    const on = d === id;
    document.getElementById('spec-' + d).hidden = !on;
    const tab = document.getElementById('tab-' + d);
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
    tab.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('[data-menu]').forEach(m => { m.hidden = true; });
  try { history.replaceState(null, '', '#' + id); } catch (err) {}
  if (!hasGsap) return;
  mm = gsap.matchMedia();
  mm.add({ rm: '(prefers-reduced-motion: no-preference)' }, ctx => {
    if (!ctx.conditions.rm) return;
    initNight(gsap.utils.selector(root));
  });
  ScrollTrigger.refresh();
}

'''
out = out[:a] + new_show + out[b:]
out = out.replace("show(dirs.indexOf(fromHash) > -1 ? fromHash : 'door');", "show(dirs.indexOf(fromHash) > -1 ? fromHash : 'cream');")
out = out.replace('<title>Crossway Directions Round Four</title>', '<title>Crossway Night Service Cream</title>')
ia = out.index('<header class="intro">'); ib = out.index('</header>', ia) + len('</header>')
intro = '''<header class="intro">
    <h1>Night Service, in a cream version</h1>
    <p>This is the same concept on warm paper, with the original navy version one tab away for comparison. The logo is used directly: the cross mark in the header, cropped large in the hero, and the full lettering in the footer. Items marked "to confirm" are placeholders, and flat blue panels show where the church's own photos go.</p>
  </header>'''
out = out[:ia] + intro + out[ib:]
open('directions-5.src.html', 'w').write(out)
final = out.replace('{{TEXT}}', open('assets/text.path').read()).replace('{{MARK}}', open('assets/mark.clean.path').read())
open('directions-5.html', 'w').write(final)
open('/private/tmp/claude-504/-Users-mscameron-code/f512529b-b29f-4efb-b4e0-ccbeca96dd90/scratchpad/check5.js','w').write(re.findall(r'<script>(.*?)</script>', final, re.S)[-1])
print(len(final)//1024, 'KB; leftover tokens:', '{{' in final, '; mock-door:', final.count('mock-door'), '; m1-:', final.count('m1-'), '; m3-:', final.count('m3-'))
