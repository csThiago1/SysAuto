/* V6c refinada + Navbar variations + Dashboard/KPI exploration */

/* ============ V6c REFINADA — com logo, saudação, busca ============ */
function ListV6c_Refined({ theme='dark', accent='#a855f7', greetName='Lucas', navStyle='floating' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f5f5f7';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';
  const carBgs = [
    'linear-gradient(135deg,#1e293b,#475569)',
    'linear-gradient(135deg,#4c1d95,#7c3aed)',
    'linear-gradient(135deg,#064e3b,#10b981)',
    'linear-gradient(135deg,#7c2d12,#f97316)',
    'linear-gradient(135deg,#831843,#ec4899)',
    'linear-gradient(135deg,#1e3a8a,#3b82f6)',
  ];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    {/* Header — logo + bell */}
    <div style={{ padding: '10px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <DscarLogo size={18} color={fg}/>
      <button style={{ background: 'transparent', border: 'none', color: fg, padding: 4, position: 'relative', display:'flex' }}>
        <Ico.bell width="22" height="22"/>
        <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, background: accent, borderRadius: 999 }}/>
      </button>
    </div>
    {/* Saudação */}
    <div style={{ padding: '4px 16px 10px' }}>
      <div style={{ fontSize: 13, color: muted }}>{greeting},</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{greetName} <span style={{ color: muted, fontWeight: 500, fontSize: 14 }}>· 6 OS abertas</span></div>
    </div>
    {/* Search */}
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: card, border: `1px solid ${border}`, padding: '11px 12px', borderRadius: 12 }}>
        <Ico.search width="16" height="16" style={{ color: muted }}/>
        <input placeholder="Placa, OS ou cliente" style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, color: fg, fontSize: 14, fontFamily: 'inherit' }}/>
        <Ico.filter width="16" height="16" style={{ color: muted }}/>
      </div>
    </div>
    {/* Filter chips */}
    <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflow: 'auto' }}>
      {['Todas (6)', 'Recepção (2)', 'Pintura (1)', 'Funilaria (1)', 'Lavagem (1)'].map((c,i) => (
        <button key={c} style={{
          padding: '5px 10px', fontSize: 11, fontWeight: 600, fontFamily:'inherit',
          background: i === 0 ? fg : 'transparent', color: i === 0 ? bg : muted,
          border: i === 0 ? 'none' : `1px solid ${border}`, borderRadius: 999, whiteSpace: 'nowrap',
        }}>{c}</button>
      ))}
    </div>
    {/* List */}
    <div style={{ flex: 1, overflow: 'auto', padding: '6px 12px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {SAMPLE_OS.map((os, i) => {
        const s = stageOf(os.stage);
        const idx = stageIdx(os.stage);
        return <div key={os.id} style={{
          background: card, borderRadius: 14, border: `1px solid ${border}`,
          padding: 12, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 10, background: carBgs[i % 6],
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.85)',
            }}>
              <Ico.car width="30" height="30"/>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: '0.04em' }}>{os.plate}</span>
                <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>#{os.id}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{os.vehicle}</div>
              <div style={{ fontSize: 11, color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{os.client}</div>
            </div>
            <span style={{ fontSize: 10, color: muted }}>{os.age}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: s.color, minWidth: 70 }}>● {os.stage}</span>
            <div style={{ flex: 1, display: 'flex', gap: 2 }}>
              {STAGES.map((st, j) => (
                <div key={j} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: j <= idx ? st.color : (isDark ? '#22222a' : '#eaeaef'),
                }}/>
              ))}
            </div>
            <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>{idx+1}/{STAGES.length}</span>
          </div>
        </div>;
      })}
    </div>
    <BottomNav active="list" accent={accent} theme={theme} style={navStyle}/>
  </div>;
}

/* ============ NAVBAR VARIATIONS — show 4 styles in stage frames ============ */
function NavStage({ children, theme='dark', label }) {
  const isDark = theme === 'dark';
  return <div style={{ position: 'relative', height: '100%', background: isDark ? '#0a0a0c' : '#f5f5f7' }}>
    <div style={{ padding: 16, color: isDark ? '#8b8b94' : '#6b7280', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
      {label}
    </div>
    <div style={{ padding: '0 16px', color: isDark ? '#f5f5f7' : '#0e0e10', fontSize: 14, lineHeight: 1.6 }}>
      <p style={{ opacity: 0.5, margin: 0 }}>conteúdo da tela…</p>
    </div>
    {children}
  </div>;
}

// NAV-A — Floating pill 5 itens com FAB central (atual)
function NavA({ theme, accent }) {
  return <NavStage theme={theme} label="A · Pill flutuante · 5 itens · FAB central">
    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </NavStage>;
}

// NAV-B — Segmented full-width
function NavB({ theme, accent }) {
  return <NavStage theme={theme} label="B · Barra plena · 5 itens · FAB inline">
    <BottomNav active="list" accent={accent} theme={theme} style="segmented"/>
  </NavStage>;
}

// NAV-C — 4 itens + FAB destacado fora
function NavC({ theme='dark', accent='#ef4444' }) {
  const isDark = theme === 'dark';
  const items = [
    { id: 'home', icon: Ico.home || Ico.list, label: 'Início' },
    { id: 'list', icon: Ico.list, label: 'OS', active: true },
    { id: 'cal', icon: Ico.cal, label: 'Agenda' },
    { id: 'cog', icon: Ico.cog, label: 'Mais' },
  ];
  return <NavStage theme={theme} label="C · 4 itens + FAB destacado fora">
    {/* FAB */}
    <button style={{
      position: 'absolute', bottom: 88, right: 16,
      width: 56, height: 56, borderRadius: 18, border: 'none',
      background: accent, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 8px 24px color-mix(in oklab, ${accent} 50%, transparent)`,
    }}>
      <Ico.plus width="26" height="26"/>
    </button>
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: '10px 8px 24px',
      background: isDark ? 'rgba(15,15,18,.92)' : 'rgba(255,255,255,.95)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${isDark ? '#1d1d22' : '#eaeaef'}`,
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    }}>
      {items.map(it => (
        <button key={it.id} style={{
          background: 'transparent', border: 'none',
          color: it.active ? accent : (isDark ? '#8b8b94' : '#6b7280'),
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 10, fontWeight: 600,
        }}>
          <it.icon width="22" height="22"/>
          {it.label}
        </button>
      ))}
    </div>
  </NavStage>;
}

// NAV-D — 3 itens essenciais + FAB grande no centro (mais focado)
function NavD({ theme='dark', accent='#ef4444' }) {
  const isDark = theme === 'dark';
  return <NavStage theme={theme} label="D · 3 itens + FAB grande central · minimal">
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: '12px 16px 24px',
      background: isDark ? 'rgba(15,15,18,.92)' : 'rgba(255,255,255,.95)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${isDark ? '#1d1d22' : '#eaeaef'}`,
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', gap: 24,
    }}>
      <button style={{
        background: 'transparent', border: 'none', color: accent,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
      }}>
        <Ico.list width="24" height="24"/>OS
      </button>
      <button style={{
        background: accent, border: 'none', color: '#fff',
        width: 60, height: 60, borderRadius: 22, marginTop: -28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 10px 28px color-mix(in oklab, ${accent} 60%, transparent)`,
      }}>
        <Ico.plus width="28" height="28"/>
      </button>
      <button style={{
        background: 'transparent', border: 'none',
        color: isDark ? '#8b8b94' : '#6b7280',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
      }}>
        <Ico.cal width="24" height="24"/>Agenda
      </button>
    </div>
  </NavStage>;
}

// NAV-E — Tab bar com label apenas no ativo (estilo iOS 17 / Apple)
function NavE({ theme='dark', accent='#ef4444' }) {
  const isDark = theme === 'dark';
  const items = [
    { id: 'list', icon: Ico.list, label: 'OS', active: true },
    { id: 'cal', icon: Ico.cal, label: 'Agenda' },
    { id: 'add', icon: Ico.plus, label: 'Nova' },
    { id: 'bell', icon: Ico.bell, label: 'Avisos' },
    { id: 'cog', icon: Ico.cog, label: 'Ajustes' },
  ];
  return <NavStage theme={theme} label="E · Pill com label apenas no ativo">
    <div style={{
      position: 'absolute', left: 16, right: 16, bottom: 18,
      background: isDark ? '#15151a' : '#fff',
      border: `1px solid ${isDark ? '#26262c' : '#e5e5ea'}`,
      borderRadius: 999, padding: 6,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,.4)' : '0 4px 16px rgba(0,0,0,.08)',
    }}>
      {items.map(it => (
        <button key={it.id} style={{
          background: it.active ? accent : 'transparent', border: 'none',
          color: it.active ? '#fff' : (isDark ? '#8b8b94' : '#6b7280'),
          display: 'flex', alignItems: 'center', gap: 6,
          padding: it.active ? '8px 14px' : '8px 12px',
          borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12, fontWeight: 600,
        }}>
          <it.icon width="20" height="20"/>
          {it.active && it.label}
        </button>
      ))}
    </div>
  </NavStage>;
}

/* ============ DASHBOARD / KPI EXPLORATION ============ */

// HOME-A — Sem dashboard. App abre direto na lista (V6c já mostra isso).
// HOME-B — Dashboard separado: KPIs no topo + atalhos + lista resumida
function HomeWithDash({ theme='dark', accent='#a855f7' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f5f5f7';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';

  const Stat = ({ label, value, hint, color }) => (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 12, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || fg, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: muted }}>{hint}</div>
    </div>
  );

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '10px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <DscarLogo size={18} color={fg}/>
      <button style={{ background: 'transparent', border: 'none', color: fg, padding: 4, display:'flex', position:'relative' }}>
        <Ico.bell width="22" height="22"/>
        <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, background: accent, borderRadius: 999 }}/>
      </button>
    </div>
    <div style={{ padding: '4px 16px 16px' }}>
      <div style={{ fontSize: 13, color: muted }}>Boa tarde,</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Lucas</div>
    </div>
    <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 100px' }}>
      {/* KPI row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: '0 4px' }}>
        <Stat label="Em aberto" value="6" hint="2 atrasadas" color={fg}/>
        <Stat label="Hoje" value="3" hint="entregas" color="#10b981"/>
        <Stat label="Faturado" value="R$8,4k" hint="esta semana" color={accent}/>
      </div>
      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: '0 4px', marginBottom: 18 }}>
        {[
          { icon: Ico.plus, label: 'Nova OS', primary: true },
          { icon: Ico.cal, label: 'Agendar' },
          { icon: Ico.search, label: 'Buscar veículo' },
          { icon: Ico.bell, label: 'Avisos (3)' },
        ].map((a,i) => (
          <button key={i} style={{
            background: a.primary ? accent : card,
            border: a.primary ? 'none' : `1px solid ${border}`,
            color: a.primary ? '#fff' : fg,
            padding: '14px 12px', borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}>
            <a.icon width="18" height="18"/>{a.label}
          </button>
        ))}
      </div>
      {/* Em andamento — lista resumida */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px 8px' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Em andamento</div>
        <button style={{ background: 'transparent', border: 'none', color: muted, fontSize: 11, fontFamily:'inherit' }}>Ver todas →</button>
      </div>
      {SAMPLE_OS.slice(0, 3).map(os => {
        const s = stageOf(os.stage);
        return <div key={os.id} style={{
          background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10,
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
        }}>
          <Plate value={os.plate} size={11} theme={theme}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{os.vehicle}</div>
            <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>● {os.stage}</div>
          </div>
          <span style={{ fontSize: 10, color: muted }}>{os.age}</span>
        </div>;
      })}
    </div>
    <BottomNav active="home" accent={accent} theme={theme} style="floating"/>
  </div>;
}

// HOME-C — KPIs minimalistas no topo da própria lista (sem aba dashboard separada)
function ListWithKPIs({ theme='dark', accent='#a855f7' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f5f5f7';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';
  const carBgs = ['linear-gradient(135deg,#1e293b,#475569)','linear-gradient(135deg,#4c1d95,#7c3aed)','linear-gradient(135deg,#064e3b,#10b981)','linear-gradient(135deg,#7c2d12,#f97316)','linear-gradient(135deg,#831843,#ec4899)','linear-gradient(135deg,#1e3a8a,#3b82f6)'];

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '10px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <DscarLogo size={18} color={fg}/>
      <button style={{ background: 'transparent', border: 'none', color: fg, padding: 4, display:'flex', position:'relative' }}>
        <Ico.bell width="22" height="22"/>
      </button>
    </div>
    <div style={{ padding: '4px 16px 12px' }}>
      <div style={{ fontSize: 13, color: muted }}>Boa tarde, Lucas</div>
    </div>
    {/* KPI strip — minimal inline */}
    <div style={{ padding: '0 16px 12px', display: 'flex', gap: 16, alignItems: 'baseline' }}>
      <div><span style={{ fontSize: 24, fontWeight: 700 }}>6</span> <span style={{ fontSize: 11, color: muted }}>OS abertas</span></div>
      <div style={{ width: 1, height: 22, background: border }}/>
      <div><span style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>2</span> <span style={{ fontSize: 11, color: muted }}>atrasadas</span></div>
      <div style={{ width: 1, height: 22, background: border }}/>
      <div><span style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>3</span> <span style={{ fontSize: 11, color: muted }}>entregas hoje</span></div>
    </div>
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: card, border: `1px solid ${border}`, padding: '11px 12px', borderRadius: 12 }}>
        <Ico.search width="16" height="16" style={{ color: muted }}/>
        <input placeholder="Placa, OS ou cliente" style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, color: fg, fontSize: 14, fontFamily: 'inherit' }}/>
      </div>
    </div>
    <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {SAMPLE_OS.map((os, i) => {
        const s = stageOf(os.stage);
        const idx = stageIdx(os.stage);
        return <div key={os.id} style={{
          background: card, borderRadius: 14, border: `1px solid ${border}`, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 10, background: carBgs[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.85)' }}>
              <Ico.car width="30" height="30"/>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: '0.04em' }}>{os.plate}</span>
                <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>#{os.id}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{os.vehicle}</div>
              <div style={{ fontSize: 11, color: muted }}>{os.client}</div>
            </div>
            <span style={{ fontSize: 10, color: muted }}>{os.age}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: s.color, minWidth: 70 }}>● {os.stage}</span>
            <div style={{ flex: 1, display: 'flex', gap: 2 }}>
              {STAGES.map((st, j) => (
                <div key={j} style={{ flex: 1, height: 3, borderRadius: 2, background: j <= idx ? st.color : (isDark ? '#22222a' : '#eaeaef') }}/>
              ))}
            </div>
          </div>
        </div>;
      })}
    </div>
    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

Object.assign(window, { ListV6c_Refined, NavA, NavB, NavC, NavD, NavE, HomeWithDash, ListWithKPIs });
