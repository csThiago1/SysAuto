/* Final direction: Nav C com Home + Dashboard financeiro */

function NavCWithHome({ theme='dark', accent='#a855f7', active='home' }) {
  const isDark = theme === 'dark';
  const items = [
    { id: 'home', icon: Ico.home || Ico.list, label: 'Início' },
    { id: 'list', icon: Ico.list, label: 'OS' },
    { id: 'cal', icon: Ico.cal, label: 'Agenda' },
    { id: 'cog', icon: Ico.cog, label: 'Mais' },
  ];
  return <>
    <button style={{
      position: 'absolute', bottom: 88, right: 16,
      width: 56, height: 56, borderRadius: 18, border: 'none',
      background: accent, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 8px 24px color-mix(in oklab, ${accent} 50%, transparent)`,
      zIndex: 5, cursor: 'pointer',
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
      {items.map(it => {
        const isActive = it.id === active;
        return <button key={it.id} style={{
          background: 'transparent', border: 'none',
          color: isActive ? accent : (isDark ? '#8b8b94' : '#6b7280'),
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 10, fontWeight: 600,
        }}>
          <it.icon width="22" height="22"/>
          {it.label}
        </button>;
      })}
    </div>
  </>;
}

/* Dashboard "Início" — financeiro + operacional */
function HomeDashboard({ theme='dark', accent='#a855f7' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f5f5f7';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';
  const sub = isDark ? '#1f1f24' : '#f0f0f4';

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    {/* Header */}
    <div style={{ padding: '10px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <DscarLogo size={18} color={fg}/>
      <button style={{ background: 'transparent', border: 'none', color: fg, padding: 4, position: 'relative', display:'flex' }}>
        <Ico.bell width="22" height="22"/>
        <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, background: accent, borderRadius: 999 }}/>
      </button>
    </div>
    <div style={{ padding: '4px 16px 14px' }}>
      <div style={{ fontSize: 13, color: muted }}>Boa tarde,</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Lucas</div>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 110px' }}>
      {/* Faturamento — card hero */}
      <div style={{
        background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #000))`,
        borderRadius: 18, padding: 18, color: '#fff', marginBottom: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '.06em' }}>Faturamento · Novembro</span>
          <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,.2)', padding: '3px 8px', borderRadius: 999 }}>↑ 12%</span>
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>R$ 47.820</div>
        {/* mini barchart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 36, marginBottom: 6 }}>
          {[42, 28, 56, 38, 64, 48, 72, 60, 78, 52, 66, 84].map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`, borderRadius: 2,
              background: i === 11 ? '#fff' : 'rgba(255,255,255,.45)',
            }}/>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, opacity: 0.7 }}>
          <span>jan</span><span>fev</span><span>mar</span><span>abr</span><span>mai</span><span>jun</span>
          <span>jul</span><span>ago</span><span>set</span><span>out</span><span>nov</span><span style={{ fontWeight: 700, opacity: 1 }}>dez</span>
        </div>
      </div>

      {/* Segunda linha — 3 stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 9, color: muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Ticket méd.</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>R$ 1.240</div>
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 9, color: muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>A receber</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: '#10b981' }}>R$ 18.4k</div>
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 9, color: muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Vencidos</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: '#ef4444' }}>R$ 2.1k</div>
        </div>
      </div>

      {/* Operacional */}
      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '8px 4px 8px' }}>Operacional · hoje</div>
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { v: '6', l: 'OS abertas', c: fg },
            { v: '2', l: 'atrasadas', c: '#ef4444' },
            { v: '3', l: 'entregas', c: '#10b981' },
            { v: '4', l: 'agendadas', c: accent },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', borderRight: i < 3 ? `1px solid ${border}` : 'none' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 9, color: muted, marginTop: 4, fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline distribuição */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Pipeline</span>
          <span style={{ fontSize: 10, color: muted }}>distribuição atual</span>
        </div>
        {STAGES.map(st => {
          const counts = { 'Recepção': 2, 'Funilaria': 1, 'Pintura': 1, 'Montagem': 0, 'Lavagem': 1, 'Entrega': 1 };
          const count = counts[st.name] || 0;
          const pct = (count / 6) * 100;
          return <div key={st.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 70, fontSize: 10, color: muted }}>{st.name}</span>
            <div style={{ flex: 1, height: 6, background: sub, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: st.color, borderRadius: 3 }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 14, textAlign: 'right' }}>{count}</span>
          </div>;
        })}
      </div>

      {/* Ações rápidas */}
      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '8px 4px 8px' }}>Ações rápidas</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {[
          { icon: Ico.plus, label: 'Nova OS', primary: true },
          { icon: Ico.cal, label: 'Agendar' },
          { icon: Ico.search, label: 'Buscar veículo' },
          { icon: Ico.bell, label: 'Avisos · 3' },
        ].map((a, i) => (
          <button key={i} style={{
            background: a.primary ? accent : card,
            border: a.primary ? 'none' : `1px solid ${border}`,
            color: a.primary ? '#fff' : fg,
            padding: '14px 12px', borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <a.icon width="18" height="18"/>{a.label}
          </button>
        ))}
      </div>
    </div>

    <NavCWithHome theme={theme} accent={accent} active="home"/>
  </div>;
}

Object.assign(window, { HomeDashboard, NavCWithHome });
