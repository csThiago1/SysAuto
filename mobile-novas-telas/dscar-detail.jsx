/* OS Detail variations.
   Tabs: Geral, Peças, Fotos, Histórico
   Each variation explores a different visual approach but shares the same content. */

function HeaderShared({ os, theme, accent, onBack }) {
  const isDark = theme === 'dark';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const border = isDark ? '#22222a' : '#eaeaef';
  const s = stageOf(os.stage);
  return <div style={{
    padding: '8px 16px 12px',
    borderBottom: `1px solid ${border}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <button style={{ background: 'transparent', border: 'none', color: fg, padding: 4, display: 'flex' }}>
        <Ico.back width="22" height="22"/>
      </button>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: muted, fontWeight: 600 }}>OS #{os.id}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Plate value={os.plate} size={13} theme={theme}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{os.vehicle}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StageBadge stage={os.stage} size="sm" theme={theme}/>
          <span style={{ fontSize: 11, color: muted }}>· {os.age}</span>
        </div>
      </div>
    </div>
  </div>;
}

function TabBar({ tabs, active, onChange, theme, accent, style='underline' }) {
  const isDark = theme === 'dark';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const border = isDark ? '#22222a' : '#eaeaef';

  if (style === 'pill') {
    return <div style={{
      margin: '12px 16px',
      display: 'flex', overflow: 'auto', gap: 6,
      background: isDark ? '#15151a' : '#f1f1f4',
      padding: 4, borderRadius: 10,
    }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: '7px 12px', fontSize: 12, fontWeight: 600,
          background: t === active ? (isDark ? '#26262d' : '#fff') : 'transparent',
          color: t === active ? fg : muted,
          border: 'none', borderRadius: 7, fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          boxShadow: t === active ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
        }}>{t}</button>
      ))}
    </div>;
  }
  // Underline
  return <div style={{
    display: 'flex', overflow: 'auto', gap: 0, padding: '0 8px',
    borderBottom: `1px solid ${border}`,
  }}>
    {tabs.map(t => (
      <button key={t} onClick={() => onChange(t)} style={{
        padding: '12px 12px',
        fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        background: 'transparent', border: 'none',
        color: t === active ? accent : muted,
        position: 'relative', whiteSpace: 'nowrap',
      }}>
        {t}
        {t === active && <div style={{
          position: 'absolute', bottom: -1, left: 8, right: 8, height: 2, background: accent, borderRadius: 2,
        }}/>}
      </button>
    ))}
  </div>;
}

/* ============== Detail V1 — Refined Geral ============== */
function DetailGeralV1({ theme='dark', accent='#ef4444' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f7f7f9';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';
  const subtle = isDark ? '#10101a' : '#fafafb';
  const os = SAMPLE_OS[0];

  const [tab, setTab] = React.useState('Geral');
  const tabs = ['Geral', 'Peças', 'Serviços', 'Fotos', 'Docs', 'Histórico'];

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
    <HeaderShared os={os} theme={theme} accent={accent}/>
    <TabBar tabs={tabs} active={tab} onChange={setTab} theme={theme} accent={accent} style="underline"/>

    <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 100px' }}>
      {/* Primary actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        <button style={{
          background: 'transparent', border: `1px solid ${accent}`, color: accent,
          padding: '12px', borderRadius: 12, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}><Ico.swap width="16" height="16"/>Avançar</button>
        <button style={{
          background: accent, border: 'none', color: '#fff',
          padding: '12px', borderRadius: 12, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}><Ico.cam width="16" height="16"/>Checklist</button>
      </div>

      {/* Section: Dados gerais */}
      <SectionLabel theme={theme}>Dados gerais</SectionLabel>
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '4px 14px', marginBottom: 18 }}>
        {[
          ['Cliente', 'Thiago Souza Campos', false],
          ['Tipo', 'Seguradora · Lataria/Pintura', false],
          ['Consultor', '—', true],
          ['Abertura', '09 mai 2026, 11:07', false],
          ['Previsão', '14 mai 2026', false],
        ].map(([k,v,empty], i, arr) => (
          <div key={k} style={{
            padding: '12px 0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: i === arr.length-1 ? 'none' : `1px solid ${border}`,
          }}>
            <span style={{ fontSize: 12, color: muted }}>{k}</span>
            <span style={{ fontSize: 13, fontWeight: empty ? 400 : 600, color: empty ? muted : fg, fontStyle: empty ? 'italic' : 'normal' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Section: Resumo financeiro */}
      <SectionLabel theme={theme}>Resumo financeiro</SectionLabel>
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 14 }}>
        {[['Peças', 'R$ 0,00'], ['Serviços', 'R$ 0,00']].map(([k,v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: muted }}>
            <span>{k}</span><span>{v}</span>
          </div>
        ))}
        <div style={{ height: 1, background: border, margin: '8px 0' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: accent }}>R$ 0,00</span>
        </div>
      </div>
    </div>
    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

function SectionLabel({ children, theme }) {
  const muted = theme==='dark' ? '#8b8b94' : '#6b7280';
  return <div style={{
    fontSize: 11, color: muted, fontWeight: 600, letterSpacing: '.08em',
    textTransform: 'uppercase', marginBottom: 8, padding: '0 4px',
  }}>{children}</div>;
}

/* ============== Detail V2 — Peças (better empty state) ============== */
function DetailPecasV1({ theme='light', accent='#3b82f6' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f7f7f9';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';
  const os = SAMPLE_OS[0];

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <HeaderShared os={os} theme={theme} accent={accent}/>
    <TabBar tabs={['Geral', 'Peças', 'Serviços', 'Fotos', 'Docs', 'Histórico']} active="Peças" onChange={()=>{}} theme={theme} accent={accent} style="pill"/>

    <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 100px' }}>
      <div style={{
        background: card, border: `1px dashed ${border}`,
        borderRadius: 16, padding: '40px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10,
        marginBottom: 14,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: isDark ? '#1e1e26' : '#eef2ff',
          color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ico.wrench width="26" height="26"/>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Sem peças adicionadas</div>
        <div style={{ fontSize: 12, color: muted, maxWidth: 240, lineHeight: 1.4 }}>
          Adicione manualmente ou importe do orçamento da seguradora.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, width: '100%' }}>
          <button style={{
            flex: 1, background: 'transparent', border: `1px solid ${border}`,
            color: fg, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>Importar</button>
          <button style={{
            flex: 1, background: accent, border: 'none', color: '#fff',
            padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>+ Adicionar peça</button>
        </div>
      </div>

      <SectionLabel theme={theme}>Sugestões para Fiat UNO</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['Para-choque dianteiro', 'Farol esquerdo', 'Capô', 'Lanterna LD'].map(s => (
          <button key={s} style={{
            background: card, border: `1px solid ${border}`, borderRadius: 10,
            padding: '10px 12px', textAlign: 'left', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            color: fg, fontFamily: 'inherit', fontSize: 13,
          }}>
            <span>{s}</span>
            <span style={{ color: accent, fontSize: 18, fontWeight: 600 }}>+</span>
          </button>
        ))}
      </div>
    </div>
    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

/* ============== Fotos rebuilt ============== */
function DetailFotosV1({ theme='dark', accent='#a855f7' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f7f7f9';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';
  const os = SAMPLE_OS[1];

  const [seg, setSeg] = React.useState('Acompanhamento');

  // pseudo photos
  const photoBg = (i) => ['linear-gradient(135deg,#1e293b,#475569)', 'linear-gradient(135deg,#374151,#6b7280)', 'linear-gradient(135deg,#0f172a,#334155)', 'linear-gradient(135deg,#1f2937,#4b5563)'][i % 4];

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <HeaderShared os={os} theme={theme} accent={accent}/>
    <TabBar tabs={['Geral', 'Peças', 'Serviços', 'Fotos', 'Docs', 'Histórico']} active="Fotos" onChange={()=>{}} theme={theme} accent={accent} style="pill"/>

    {/* Segmented within tab */}
    <div style={{ padding: '4px 16px 12px', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 4, background: isDark ? '#15151a' : '#f1f1f4', padding: 3, borderRadius: 10 }}>
        {['Acompanhamento', 'Checklist', 'Outras'].map(s => (
          <button key={s} onClick={() => setSeg(s)} style={{
            padding: '6px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            background: seg === s ? (isDark ? '#26262d' : '#fff') : 'transparent',
            color: seg === s ? fg : muted, border: 'none', borderRadius: 7,
          }}>{s}</button>
        ))}
      </div>
      <button style={{
        background: accent, border: 'none', color: '#fff',
        padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 4,
      }}><Ico.cam width="14" height="14"/> Adicionar</button>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 100px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[0,1,2,3,4,5,6,7].map(i => (
          <div key={i} style={{
            aspectRatio: '1 / 1', background: photoBg(i), borderRadius: 10,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', bottom: 4, left: 4, fontSize: 9, fontWeight: 600,
              color: '#fff', background: 'rgba(0,0,0,.5)', padding: '2px 4px', borderRadius: 4,
              fontFamily: "'Geist Mono', monospace",
            }}>07.05 11:0{i}</div>
            {i < 4 && <div style={{
              position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 999,
              background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}><Ico.check width="11" height="11"/></div>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Por etapa</div>
        {[
          { e: 'Vistoria Inicial', n: 1 },
          { e: 'Funilaria', n: 3 },
          { e: 'Pintura', n: 0 },
        ].map(g => {
          const s = stageOf(g.e);
          return <div key={g.e} style={{
            background: card, border: `1px solid ${border}`, borderRadius: 12,
            padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{g.e}</div>
              <div style={{ fontSize: 11, color: muted }}>{g.n} fotos</div>
            </div>
            <Ico.chev width="16" height="16" style={{ color: muted }}/>
          </div>;
        })}
      </div>
    </div>
    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

/* ============== Histórico (timeline) ============== */
function DetailHistoricoV1({ theme='dark', accent='#10b981' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f7f7f9';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';
  const os = SAMPLE_OS[1];

  const events = [
    { from: 'Funilaria', to: 'Pintura', when: '08 mai, 16:03', who: 'Thiago' },
    { from: 'Reparo', to: 'Funilaria', when: '08 mai, 16:03', who: 'Thiago' },
    { from: 'Orçamento', to: 'Reparo', when: '08 mai, 16:03', who: 'Thiago' },
    { from: 'Vistoria Inicial', to: 'Orçamento', when: '08 mai, 16:03', who: 'Thiago' },
    { from: 'Recepção', to: 'Vistoria Inicial', when: '07 mai, 11:06', who: 'Thiago' },
  ];

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <HeaderShared os={os} theme={theme} accent={accent}/>
    <TabBar tabs={['Geral', 'Peças', 'Serviços', 'Fotos', 'Docs', 'Histórico']} active="Histórico" onChange={()=>{}} theme={theme} accent={accent} style="pill"/>

    <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 100px' }}>
      {/* Pipeline visual */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: muted, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>Pipeline da OS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {STAGES.map((s, i) => {
            const isCurrent = s.name === os.stage;
            const done = i <= stageIdx(os.stage);
            return <React.Fragment key={s.name}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                <div style={{
                  width: isCurrent ? 24 : 16, height: isCurrent ? 24 : 16,
                  borderRadius: 999,
                  background: done ? s.color : (isDark ? '#26262d' : '#e3e3e8'),
                  border: isCurrent ? `2px solid ${s.color}` : 'none',
                  outline: isCurrent ? `4px solid ${s.color}30` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done && !isCurrent && <Ico.check width="9" height="9" style={{ color: '#fff' }}/>}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: done ? fg : muted, letterSpacing: '.04em', textAlign: 'center', maxWidth: 50 }}>
                  {s.short}
                </div>
              </div>
              {i < STAGES.length-1 && <div style={{ flex: 1, height: 2, background: i < stageIdx(os.stage) ? STAGES[i+1].color : (isDark ? '#26262d' : '#e3e3e8'), borderRadius: 1 }}/>}
            </React.Fragment>;
          })}
        </div>
      </div>

      <SectionLabel theme={theme}>Linha do tempo</SectionLabel>
      <div style={{ position: 'relative', paddingLeft: 22 }}>
        <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, background: border }}/>
        {events.map((e, i) => {
          const fromStage = stageOf(e.from);
          const toStage = stageOf(e.to);
          return <div key={i} style={{ position: 'relative', marginBottom: 14 }}>
            <div style={{
              position: 'absolute', left: -22, top: 4,
              width: 16, height: 16, borderRadius: 999,
              background: toStage.color, border: `3px solid ${bg}`,
            }}/>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: muted, fontWeight: 500 }}>{e.from}</span>
                <span style={{ color: muted }}>→</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: toStage.color,
                }}>{e.to}</span>
              </div>
              <div style={{ fontSize: 11, color: muted }}>{e.when} · por {e.who}</div>
            </div>
          </div>;
        })}
      </div>
    </div>
    <BottomNav active="list" accent={accent} theme={theme} style="floating"/>
  </div>;
}

Object.assign(window, { DetailGeralV1, DetailPecasV1, DetailFotosV1, DetailHistoricoV1, HeaderShared, TabBar, SectionLabel });
