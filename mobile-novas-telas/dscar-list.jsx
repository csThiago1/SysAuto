/* List screen variations — 6 directions
   v1 Refined Dark (current, polished)        — accent restraint, clearer hierarchy
   v2 Light Minimal                            — paper-on-table, soft accents
   v3 Compact Density                          — high-density list, scan-friendly
   v4 Stage-Grouped Sections                   — group by status, collapsible
   v5 Timeline Cards                           — shows OS progress as inline pill timeline
   v6 Big Visual / Photo-first                 — vehicle photo prominent, modern card */

const headerStripe = { v1: '#3b82f6', v2: '#a855f7', v3: '#8b5cf6', v4: '#3b82f6', v5: '#f59e0b', v6: '#a855f7' };

/* --------- Common bits --------- */
function Plate({ value, style="mono", size=14, theme="dark" }) {
  const isDark = theme === 'dark';
  if (style === 'pill') {
    return <span style={{
      fontFamily: "'Geist Mono', ui-monospace, monospace",
      fontWeight: 600,
      letterSpacing: '0.02em',
      fontSize: size,
      padding: `${size*0.28}px ${size*0.7}px`,
      background: isDark ? '#1a1a1f' : '#f1f1f4',
      color: isDark ? '#f5f5f7' : '#1a1a1f',
      borderRadius: 999,
      border: `1px solid ${isDark ? '#2a2a30' : '#e1e1e6'}`,
      display: 'inline-block',
    }}>{value}</span>;
  }
  // mono brick (current style)
  return <span style={{
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    letterSpacing: '0.18em',
    fontSize: size,
    padding: `${size*0.45}px ${size*0.75}px`,
    background: isDark ? '#1a1a1f' : '#eeeef1',
    color: isDark ? '#f5f5f7' : '#0e0e10',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#2a2a30' : '#dcdce2'}`,
    display: 'inline-block',
  }}>{value}</span>;
}

function StageBadge({ stage, size='md', theme='dark' }) {
  const s = stageOf(stage);
  const isDark = theme === 'dark';
  const sizes = { sm: { fs: 10, py: 3, px: 8 }, md: { fs: 11, py: 4, px: 10 }, lg: { fs: 12, py: 5, px: 12 } };
  const z = sizes[size];
  return <span style={{
    fontSize: z.fs, fontWeight: 600, letterSpacing: '0.02em',
    padding: `${z.py}px ${z.px}px`,
    color: s.color,
    background: isDark ? s.bg : `color-mix(in oklab, ${s.color} 12%, white)`,
    borderRadius: 999,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: isDark ? 'none' : `1px solid color-mix(in oklab, ${s.color} 25%, white)`,
  }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: s.color }}/>
    {stage}
  </span>;
}

function StageProgress({ stage, theme='dark' }) {
  const idx = stageIdx(stage);
  const isDark = theme === 'dark';
  return <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
    {STAGES.map((s, i) => (
      <div key={s.name} style={{
        width: i === idx ? 14 : 6, height: 4, borderRadius: 2,
        background: i <= idx ? s.color : (isDark ? '#2a2a30' : '#e3e3e8'),
        transition: 'all .2s'
      }}/>
    ))}
  </div>;
}

/* --------- Logo lockup --------- */
function DscarLogo({ size=28, color='#fff' }) {
  return <div style={{
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 800, fontSize: size, letterSpacing: '0.04em', color,
    display: 'inline-flex', alignItems: 'center', gap: size*0.25,
  }}>
    <svg width={size*0.9} height={size*0.7} viewBox="0 0 30 22" fill="none">
      <path d="M3 3L6 9 H24 L27 3" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="2" y="9" width="26" height="11" rx="2" stroke={color} strokeWidth="2.5"/>
      <circle cx="9" cy="20" r="2" fill={color}/>
      <circle cx="21" cy="20" r="2" fill={color}/>
    </svg>
    DSCAR
  </div>;
}

/* --------- Bottom Nav --------- */
function BottomNav({ active='list', accent='#ef4444', theme='dark', style='floating' }) {
  const isDark = theme === 'dark';
  const items = [
    { id: 'list', icon: Ico.list, label: 'OS' },
    { id: 'cal', icon: Ico.cal, label: 'Agenda' },
    { id: 'add', icon: Ico.plus, label: '', primary: true },
    { id: 'bell', icon: Ico.bell, label: 'Avisos', badge: true },
    { id: 'cog', icon: Ico.cog, label: 'Ajustes' },
  ];

  if (style === 'segmented') {
    // Segmented bar without floating add — cleaner
    return <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: '8px 12px 24px',
      background: isDark ? 'rgba(15,15,18,.92)' : 'rgba(255,255,255,.92)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${isDark ? '#1d1d22' : '#eaeaef'}`,
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4,
    }}>
      {items.map(it => {
        const isActive = it.id === active;
        if (it.primary) return <button key={it.id} style={{
          background: accent, border: 'none', color: '#fff',
          height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer'
        }}><it.icon width="22" height="22"/></button>;
        return <button key={it.id} style={{
          background: 'transparent', border: 'none',
          color: isActive ? accent : (isDark ? '#9ca3af' : '#6b7280'),
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '6px 0', cursor: 'pointer', fontSize: 10, fontWeight: 600,
          fontFamily: 'inherit',
        }}>
          <div style={{ position: 'relative' }}>
            <it.icon width="22" height="22"/>
            {it.badge && <span style={{ position: 'absolute', top: -1, right: -2, width: 7, height: 7, background: accent, borderRadius: 999 }}/>}
          </div>
          {it.label}
        </button>;
      })}
    </div>;
  }

  // Floating pill (current style, refined)
  return <div style={{
    position: 'absolute', left: 12, right: 12, bottom: 16,
    background: isDark ? '#1a1a1f' : '#fff',
    border: `1px solid ${isDark ? '#26262c' : '#e5e5ea'}`,
    borderRadius: 22, padding: '8px 10px',
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,.4)' : '0 4px 16px rgba(0,0,0,.08)',
  }}>
    {items.map(it => {
      const isActive = it.id === active;
      if (it.primary) return <div key={it.id} style={{ display: 'flex', justifyContent: 'center' }}>
        <button style={{
          background: accent, border: 'none', color: '#fff',
          width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: `0 6px 14px color-mix(in oklab, ${accent} 50%, transparent)`,
        }}><it.icon width="22" height="22"/></button>
      </div>;
      return <button key={it.id} style={{
        background: 'transparent', border: 'none',
        color: isActive ? accent : (isDark ? '#8b8b94' : '#6b7280'),
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '4px 0', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <div style={{ position: 'relative' }}>
          <it.icon width="20" height="20"/>
          {it.badge && <span style={{ position: 'absolute', top: -1, right: -2, width: 6, height: 6, background: accent, borderRadius: 999 }}/>}
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 600, letterSpacing: '.02em',
          opacity: isActive ? 1 : 0.7,
        }}>{it.label || ''}</span>
      </button>;
    })}
  </div>;
}

/* ============== V1 — Refined Dark ============== */
function ListV1({ theme='dark', accent='#ef4444' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f6f6f8';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#ffffff';
  const border = isDark ? '#22222a' : '#e8e8ee';

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
    {/* Header */}
    <div style={{ padding: '8px 16px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <DscarLogo size={22} color={fg}/>
        <button style={{
          background: 'transparent', border: `1px solid ${border}`,
          width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: fg, position: 'relative',
        }}>
          <Ico.bell width="18" height="18"/>
          <span style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, background: accent, borderRadius: 999 }}/>
        </button>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>OS abertas</div>
          <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>6 ordens · 2 atrasadas</div>
        </div>
        <button style={{
          background: 'transparent', border: `1px solid ${accent}`,
          color: accent, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
        }}>Na Oficina</button>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: card, border: `1px solid ${border}`,
        padding: '10px 12px', borderRadius: 12,
      }}>
        <Ico.search width="16" height="16" style={{ color: muted }}/>
        <input placeholder="Buscar por placa, número ou cliente"
          style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, color: fg, fontSize: 14, fontFamily: 'inherit' }}/>
        <Ico.filter width="16" height="16" style={{ color: muted }}/>
      </div>
    </div>

    {/* List */}
    <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {SAMPLE_OS.map(os => {
        const s = stageOf(os.stage);
        return <div key={os.id} style={{
          background: card, borderRadius: 14, padding: 14,
          border: `1px solid ${border}`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: s.color }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Plate value={os.plate} size={12} theme={theme}/>
                <span style={{ fontSize: 11, color: muted, fontWeight: 600 }}>OS #{os.id}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {os.vehicle}
              </div>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {os.client}
              </div>
              <StageBadge stage={os.stage} size="sm" theme={theme}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 11, color: muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Ico.clock width="11" height="11"/> {os.age}
              </span>
            </div>
          </div>
        </div>;
      })}
    </div>

    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

/* ============== V2 — Light Minimal ============== */
function ListV2({ theme='light', accent='#0f172a' }) {
  const fg = theme==='dark' ? '#f5f5f7' : '#0e0e10';
  const bg = theme==='dark' ? '#0e0e12' : '#fbfbfb';
  const card = theme==='dark' ? '#17171c' : '#fff';
  const muted = theme==='dark' ? '#8b8b94' : '#6e6e76';
  const border = theme==='dark' ? '#23232a' : '#ebebef';

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '12px 20px 8px', borderBottom: `1px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <DscarLogo size={20} color={fg}/>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{
            background: 'transparent', border: 'none', width: 36, height: 36, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: fg,
          }}><Ico.bell width="20" height="20"/></button>
        </div>
      </div>
    </div>
    {/* Title */}
    <div style={{ padding: '20px 20px 14px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Suas OS</div>
      <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>6 abertas · sex 9 mai</div>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, overflow: 'auto' }}>
        {['Todas (6)', 'Na oficina (4)', 'Aguardando (1)', 'Atrasadas (2)'].map((t, i) => (
          <button key={t} style={{
            padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: i === 0 ? fg : 'transparent', color: i === 0 ? bg : muted,
            border: i === 0 ? 'none' : `1px solid ${border}`, whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>{t}</button>
        ))}
      </div>
    </div>

    {/* Search */}
    <div style={{ padding: '0 20px 12px' }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: theme==='dark' ? '#1a1a20' : '#f1f1f4',
        padding: '10px 12px', borderRadius: 10,
      }}>
        <Ico.search width="16" height="16" style={{ color: muted }}/>
        <input placeholder="Placa, OS ou cliente"
          style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, color: fg, fontSize: 14, fontFamily: 'inherit' }}/>
      </div>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 110px' }}>
      {SAMPLE_OS.map((os, i) => {
        const s = stageOf(os.stage);
        return <div key={os.id} style={{
          padding: '14px 0', borderBottom: i === SAMPLE_OS.length-1 ? 'none' : `1px solid ${border}`,
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999, background: s.color,
              }}/>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600, fontSize: 13, letterSpacing: '0.05em' }}>{os.plate}</span>
              <span style={{ fontSize: 11, color: muted }}>#{os.id}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {os.vehicle} <span style={{ color: muted, fontWeight: 400 }}>· {os.client}</span>
            </div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{os.stage}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, color: muted }}>
            <span style={{ fontSize: 12 }}>{os.age}</span>
            <Ico.chev width="16" height="16"/>
          </div>
        </div>;
      })}
    </div>

    <BottomNav active="list" accent={accent} theme={theme} style="segmented"/>
  </div>;
}

/* ============== V3 — Compact Density ============== */
function ListV3({ theme='dark', accent='#ef4444' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#08080a' : '#f7f7f9';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#e8e8ee';

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${border}` }}>
      <DscarLogo size={18} color={fg}/>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ background: 'transparent', border: 'none', color: fg, padding: 6, display:'flex'}}>
          <Ico.search width="20" height="20"/>
        </button>
        <button style={{ background: 'transparent', border: 'none', color: fg, padding: 6, display:'flex'}}>
          <Ico.filter width="20" height="20"/>
        </button>
        <button style={{ background: 'transparent', border: 'none', color: fg, padding: 6, position: 'relative', display:'flex'}}>
          <Ico.bell width="20" height="20"/>
          <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, background: accent, borderRadius: 999 }}/>
        </button>
      </div>
    </div>

    {/* Pill segments */}
    <div style={{ padding: '12px 16px 8px', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>OS abertas <span style={{ color: muted, fontWeight: 500 }}>6</span></div>
      <div style={{ display: 'flex', background: card, border: `1px solid ${border}`, borderRadius: 8, padding: 2 }}>
        {['Lista', 'Cards'].map((l, i) => <button key={l} style={{
          padding: '4px 10px', fontSize: 11, fontWeight: 600, fontFamily:'inherit',
          background: i === 0 ? accent : 'transparent',
          color: i === 0 ? '#fff' : muted, border: 'none', borderRadius: 6,
        }}>{l}</button>)}
      </div>
    </div>

    {/* Compact rows */}
    <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }}>
      <div style={{ background: card }}>
        {SAMPLE_OS.map((os, i) => {
          const s = stageOf(os.stage);
          return <div key={os.id} style={{
            padding: '12px 16px', display: 'grid',
            gridTemplateColumns: '4px 1fr auto', gap: 12, alignItems: 'center',
            borderBottom: i === SAMPLE_OS.length-1 ? `1px solid ${border}` : `1px solid ${border}`,
          }}>
            <div style={{ width: 4, height: 36, background: s.color, borderRadius: 2 }}/>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>{os.plate}</span>
                <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>#{os.id}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: s.color,
                  padding: '1px 6px', borderRadius: 4,
                  background: isDark ? s.bg : `color-mix(in oklab, ${s.color} 12%, white)`,
                }}>{os.stage}</span>
              </div>
              <div style={{ fontSize: 12, color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {os.vehicle} · {os.client}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: muted }}>
              <span style={{ fontSize: 11 }}>{os.age}</span>
              <Ico.chev width="14" height="14"/>
            </div>
          </div>;
        })}
      </div>
    </div>

    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

/* ============== V4 — Stage-Grouped Sections ============== */
function ListV4({ theme='dark', accent='#3b82f6' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f6f6f8';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#e8e8ee';

  // group by stage
  const grouped = {};
  SAMPLE_OS.forEach(os => { (grouped[os.stage] = grouped[os.stage] || []).push(os); });

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '10px 16px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <DscarLogo size={20} color={fg}/>
        <button style={{
          background: 'transparent', border: `1px solid ${border}`, color: fg,
          width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Ico.bell width="18" height="18"/></button>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Por etapa</div>
        <span style={{ fontSize: 12, color: muted }}>6 OS</span>
      </div>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 100px' }}>
      {STAGES.filter(s => grouped[s.name]).map(s => (
        <div key={s.name} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color }}/>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.02em' }}>{s.name}</span>
              <span style={{ fontSize: 11, color: muted, fontWeight: 600 }}>{grouped[s.name].length}</span>
            </div>
            <button style={{ background: 'transparent', border: 'none', color: muted, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>Avançar →</button>
          </div>
          <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden' }}>
            {grouped[s.name].map((os, i) => (
              <div key={os.id} style={{
                padding: '10px 12px',
                borderTop: i === 0 ? 'none' : `1px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Plate value={os.plate} size={11} theme={theme}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {os.vehicle}
                  </div>
                  <div style={{ fontSize: 11, color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {os.client}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>OS #{os.id}</span>
                  <span style={{ fontSize: 11, color: muted }}>{os.age}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

/* ============== V5 — Timeline Cards ============== */
function ListV5({ theme='dark', accent='#f59e0b' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0c0c0f' : '#f4f4f6';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#16161c' : '#fff';
  const border = isDark ? '#22222a' : '#e8e8ee';

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '10px 16px 14px', borderBottom: `1px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <DscarLogo size={20} color={fg}/>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{
            background: 'transparent', border: `1px solid ${border}`, color: fg,
            width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
          }}><Ico.bell width="18" height="18"/>
          <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, background: accent, borderRadius: 999 }}/>
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Em andamento</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>Acompanhe o progresso</div>
        </div>
      </div>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '12px 12px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {SAMPLE_OS.map(os => {
        const s = stageOf(os.stage);
        return <div key={os.id} style={{
          background: card, borderRadius: 14, padding: 14, border: `1px solid ${border}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Plate value={os.plate} size={12} theme={theme}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>{os.vehicle}</div>
                <div style={{ fontSize: 11, color: muted }}>{os.client}</div>
              </div>
            </div>
            <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>#{os.id} · {os.age}</span>
          </div>
          <StageProgress stage={os.stage} theme={theme}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>● {os.stage}</span>
            <span style={{ fontSize: 11, color: muted }}>{stageIdx(os.stage)+1}/{STAGES.length}</span>
          </div>
        </div>;
      })}
    </div>

    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

/* ============== V6 — Photo-first Cards ============== */
function ListV6({ theme='dark', accent='#a855f7' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f5f5f7';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';

  // Pseudo-photo backgrounds via gradient
  const carBg = (i) => [
    'linear-gradient(135deg, #1e293b, #475569)',
    'linear-gradient(135deg, #4c1d95, #7c3aed)',
    'linear-gradient(135deg, #064e3b, #10b981)',
    'linear-gradient(135deg, #7c2d12, #f97316)',
    'linear-gradient(135deg, #831843, #ec4899)',
    'linear-gradient(135deg, #1e3a8a, #3b82f6)',
  ][i % 6];

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '10px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 11, color: muted, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600 }}>Sex 9 mai</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Bom dia, Thiago</div>
      </div>
      <button style={{
        background: 'transparent', border: 'none', color: fg, position: 'relative', display:'flex'
      }}><Ico.bell width="22" height="22"/>
      <span style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, background: accent, borderRadius: 999 }}/>
      </button>
    </div>

    {/* Stat strip */}
    <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {[
        { k: 6, l: 'Abertas', c: accent },
        { k: 2, l: 'Atrasadas', c: '#ef4444' },
        { k: 3, l: 'Hoje', c: '#10b981' },
      ].map(s => (
        <div key={s.l} style={{
          background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.k}</div>
          <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{s.l}</div>
        </div>
      ))}
    </div>

    <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>OS abertas</span>
      <span style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Ver todas →</span>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {SAMPLE_OS.map((os, i) => {
        const s = stageOf(os.stage);
        return <div key={os.id} style={{
          background: card, borderRadius: 16, border: `1px solid ${border}`,
          display: 'grid', gridTemplateColumns: '76px 1fr auto', gap: 12,
          padding: 10, alignItems: 'center',
        }}>
          <div style={{
            width: 76, height: 76, borderRadius: 12, background: carBg(i),
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.85)',
            position: 'relative', overflow: 'hidden',
          }}>
            <Ico.car width="34" height="34" />
            <span style={{
              position: 'absolute', bottom: 4, left: 4, right: 4, fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
              color: '#fff', background: 'rgba(0,0,0,.45)', borderRadius: 4, padding: '2px 4px', textAlign: 'center',
              fontFamily: "'Geist Mono', monospace",
            }}>{os.plate}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>OS #{os.id}</span>
              <span style={{ width: 3, height: 3, background: muted, borderRadius: 999 }}/>
              <span style={{ fontSize: 10, color: muted }}>{os.age}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {os.vehicle}
            </div>
            <div style={{ fontSize: 11, color: muted, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {os.client}
            </div>
            <StageBadge stage={os.stage} size="sm" theme={theme}/>
          </div>
          <Ico.chev width="18" height="18" style={{ color: muted }}/>
        </div>;
      })}
    </div>

    <BottomNav active="list" accent={accent} theme={theme} style="segmented"/>
  </div>;
}

Object.assign(window, { ListV1, ListV2, ListV3, ListV4, ListV5, ListV6, Plate, StageBadge, StageProgress, BottomNav, DscarLogo });
