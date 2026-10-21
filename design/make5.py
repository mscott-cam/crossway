s = open('directions-4.src.html').read()

def cut(text, start, end):
    a = text.index(start); b = text.index(end, a)
    return a, b

i1 = s.index('.m1 { --cream'); i2 = s.index('.m2 { --night'); i3 = s.index('.m3 { --amb'); iend = s.index('</style>')
css_head, css_m2, css_tail = s[:i1], s[i2:i3], '</style>'

def rep(text, old, new, count=1):
    assert text.count(old) == count, (old, text.count(old))
    return text.replace(old, new)

css_m2 = rep(css_m2, '--menu-hover: #f1efe6; background-color: var(--night);', '--menu-hover: #f1efe6; --body: #e3e8e6; --soft: #c9d4d8; --label: #f5a707; --ink: #f1efe6; --menu-mark: #12293a; --menu-btn-bg: #12293a; --menu-btn-fg: #f5a707; background-color: var(--night);')
css_m2 = rep(css_m2, '.m2 .lock-name { color: var(--cream); }', '.m2 .lock-name { color: var(--ink); }')
css_m2 = css_m2.replace('#c9d4d8', 'var(--soft)').replace('#e3e8e6; }', 'var(--body); }')
css_m2 = rep(css_m2, 'max-width: 44ch; font-size: 1.2rem; line-height: 1.45; color: #e3e8e6;', 'max-width: 44ch; font-size: 1.2rem; line-height: 1.45; color: var(--body);') if '#e3e8e6;' in css_m2 and 'color: #e3e8e6;' in css_m2 else css_m2
css_m2 = rep(css_m2, '.m2-mission .cite { color: var(--amb); }', '.m2-mission .cite { color: var(--label); }')
css_m2 = rep(css_m2, 'color: var(--amb); letter-spacing: 0; }', 'color: var(--label); letter-spacing: 0; }')
css_m2 = rep(css_m2, 'text-transform: uppercase; color: var(--cream); margin-top: 18px; }', 'text-transform: uppercase; color: var(--ink); margin-top: 18px; }')
css_m2 = rep(css_m2, 'text-transform: uppercase; color: var(--amb); padding-top: 4px; }', 'text-transform: uppercase; color: var(--label); padding-top: 4px; }')
css_m2 = rep(css_m2, 'gap: 10px; color: var(--amb); font: 800', 'gap: 10px; color: var(--label); font: 800')

day_css = '''
.menu .cw-mark { color: var(--menu-mark); }
.menu .lock-name { color: var(--menu-fg); }
.menu .menu-btn { background: var(--menu-btn-bg); color: var(--menu-btn-fg); }
.m2.is-day { --night: #f4f2ea; --body: #1f3547; --soft: #3d5565; --label: #12293a; --ink: #12293a; --rule: rgba(18, 41, 58, 0.3); --ph: #a9b9c9; --ph-in: none; --menu-bg: #12293a; --menu-fg: #f1efe6; --menu-rule: rgba(241, 239, 230, 0.24); --menu-hover: #f5a707; --menu-mark: #f5a707; --menu-btn-bg: #f5a707; --menu-btn-fg: #12293a; color: #12293a; }
.m2.is-day .m2-bar { background: #12293a; color: #f1efe6; }
.m2.is-day .blk--line { --blk-bg: #12293a; --blk-fg: #f1efe6; }
.m2.is-day .sm .blk { --blk-bg: #12293a; --blk-fg: #f1efe6; }
.m2.is-day .m2-times { background: var(--amb); color: #12293a; padding: clamp(24px, 4vw, 56px); font-size: clamp(3.4rem, 7.4vw, 6rem); min-width: 0; }
.m2.is-day .m2-scard:nth-child(1) { background: #12293a; color: #f1efe6; }
.m2.is-day .m2-scard:nth-child(3) { background: #a9b9c9; color: #12293a; }
.m2.is-day .m2-foot { background: #12293a; color: #f1efe6; }
.m2.is-day .m2-ent { background: var(--amb); }
'''
new_css = css_head + css_m2 + day_css + css_tail

# markup
h0 = s.index('<div class="wrap">')
tabs0 = s.index('<div class="tabs"'); bar0 = s.index('<div class="bar">')
m2a = s.index('<section class="mock m2 grain"'); m2b = s.index('</section>', m2a) + len('</section>')
needs0 = s.index('<section class="needs">')
m2 = s[m2a:m2b]
m2 = rep(m2, '<section class="mock m2 grain" id="mock-night" role="tabpanel" aria-labelledby="tab-night" hidden>', '<section class="mock m2 grain is-day" id="mock-main" role="tabpanel">')
mt0 = m2.index('<div class="menu-top">'); mt1 = m2.index('</div>', m2.index('data-menu-close')) 
mt1 = m2.index('</div>', mt0) + len('</div>')
menu_top = '<div class="menu-top"><a class="lock" href="#" aria-label="Crossway Bible Church"><svg class="cw-mark" style="height:34px" aria-hidden="true"><use href="#cw-mark"/></svg><svg class="lock-name" aria-hidden="true"><use href="#cw-name"/></svg></a><button class="menu-btn" type="button" data-menu-close><svg class="ico" aria-hidden="true"><use href="#i-x"/></svg> Close</button></div>'
m2 = m2[:mt0] + menu_top + m2[mt1:]

tabs_spec = '''<div class="tabs" role="tablist" aria-label="Versions" style="grid-template-columns:repeat(2,1fr)">
    <button class="tab" role="tab" id="tab-cream" aria-controls="mock-main" aria-selected="true" data-dir="cream"><strong>Night Service, cream</strong><span>The new light version on warm paper</span></button>
    <button class="tab" role="tab" id="tab-navy" aria-controls="mock-main" aria-selected="false" data-dir="navy"><strong>Night Service, navy</strong><span>The previous dark version, for comparison</span></button>
  </div>

  <section class="spec" id="spec-cream" aria-label="Cream version details">
    <div>
      <h2>Idea</h2>
      <p>Night Service with the lights on. The same giant headline, cropped cross mark, slow photo strip and stacking step cards, now on warm paper. Navy is the ink and amber becomes solid blocks: the cross mark, the Sunday times, buttons and the ENTRUSTED band. The footer returns to navy to anchor the page.</p>
    </div>
    <div>
      <h2>Look</h2>
      <div class="swatches"><span class="sw"><i style="background:#f4f2ea"></i>Paper</span><span class="sw"><i style="background:#12293a"></i>Navy</span><span class="sw"><i style="background:#f5a707"></i>Amber</span><span class="sw"><i style="background:#a9b9c9"></i>Mist</span></div>
      <p>Archivo Expanded capitals, Instrument Serif Italic, Hanken Grotesk for reading.</p>
    </div>
    <div>
      <h2>Motion</h2>
      <p>The headline lifts in line by line, the photo strip drifts slowly, step cards stack and settle as you scroll, and the wordmark rises into the footer.</p>
    </div>
    <div>
      <h2>Risk</h2>
      <p>Amber text does not read on cream, so amber appears only as fills and the big mark, and labels and dates are navy. The giant amber cross is the page's one loud element, so photos and type have to stay calm around it.</p>
    </div>
  </section>

  <section class="spec" id="spec-navy" aria-label="Navy version details" hidden>
    <div>
      <h2>Idea</h2>
      <p>The previous dark version, shown here for comparison. Deep navy with the logo in its original amber and white, and amber used for text and numerals.</p>
    </div>
    <div>
      <h2>Look</h2>
      <div class="swatches"><span class="sw"><i style="background:#12293a"></i>Night</span><span class="sw"><i style="background:#f5a707"></i>Amber</span><span class="sw"><i style="background:#f1efe6"></i>Cream</span><span class="sw"><i style="background:#2c4b62"></i>Slate</span></div>
      <p>Same type as the cream version.</p>
    </div>
    <div>
      <h2>Motion</h2>
      <p>Identical to the cream version.</p>
    </div>
    <div>
      <h2>Risk</h2>
      <p>Dark pages are harder for some older readers, so body text stays large and high contrast.</p>
    </div>
  </section>

  '''
m1a = s.index('<section class="mock m1')
body = s[h0:tabs0] + tabs_spec + s[bar0:m1a] + m2 + '\n\n  ' + s[needs0:]
head_html = s[s.index('<style>')+0:0]  # unused
pre = s[:s.index('<style>')]
style_to_wrap = new_css
mid = s[iend+len('</style>'):h0]
out = pre + new_css.replace('</style>', '</style>', 1) + mid + body
open('directions-5.stage.html', 'w').write(out)
print(len(out))
