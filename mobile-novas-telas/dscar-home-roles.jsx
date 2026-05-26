/* Dashboards por papel: Técnico, Consultor, Gerente */

function HomeTecnico({ theme='dark', accent='#ea0e03' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f5f5f7';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';
  const myOS = SAMPLE_OS.slice(0, 4);

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '10px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <DscarLogo size={18} color={fg}/>
      <button style={{ background: 'transparent', border: 'none', color: fg, padding: 4, position: 'relative', display:'flex' }}>
        <Ico.bell width="22" height="22"/>
        <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, background: accent, borderRadius: 999 }}/>
      </button>
    </div>
    <div style={{ padding: '4px 16px 14px' }}>
      <div style={{ fontSize: 13, color: muted }}>Bom dia,</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Carlos <span style={{ color: muted, fontWeight: 500, fontSize: 14 }}>· Pintor</span></div>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 110px' }}>
      {/* Foco: minhas OS de hoje */}
      <div style={{
        background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #000))`,
        borderRadius: 18, padding: 18, color: '#fff', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Minha jornada · hoje</div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 12 }}>
          <div><div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>4</div><div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>OS atribuídas</div></div>
          <div><div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>2</div><div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>concluir hoje</div></div>
          <div><div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>6h</div><div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>previsto</div></div>
        </div>
        <button style={{
          background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff',
          padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Próxima: Civic 2020 · Pintura</span>
          <span>→</span>
        </button>
      </div>

      {/* Stats operacionais simples */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>12</div>
          <div style={{ fontSize: 9, color: muted, fontWeight: 600, marginTop: 2 }}>concluídas mês</div>
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>2.3d</div>
          <div style={{ fontSize: 9, color: muted, fontWeight: 600, marginTop: 2 }}>tempo médio</div>
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: accent }}>R$2,4k</div>
          <div style={{ fontSize: 9, color: muted, fontWeight: 600, marginTop: 2 }}>comissão mês</div>
        </div>
      </div>

      {/* Minhas OS — fila */}
      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '8px 4px 8px' }}>Minha fila</div>
      {myOS.map((os, i) => {
        const s = stageOf(os.stage);
        return <div key={os.id} style={{
          background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 12, marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: i === 0 ? accent : (isDark ? '#22222a' : '#eaeaef'),
            color: i === 0 ? '#fff' : muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, fontFamily: "'Geist Mono', monospace",
          }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Plate value={os.plate} size={11} theme={theme}/>
            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{os.vehicle}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>● {os.stage}</span>
        </div>;
      })}
    </div>

    <NavCWithHome theme={theme} accent={accent} active="home"/>
  </div>;
}

function HomeConsultor({ theme='dark', accent='#ea0e03' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f5f5f7';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '10px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <DscarLogo size={18} color={fg}/>
      <button style={{ background: 'transparent', border: 'none', color: fg, padding: 4, position: 'relative', display:'flex' }}>
        <Ico.bell width="22" height="22"/>
        <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, background: accent, borderRadius: 999 }}/>
      </button>
    </div>
    <div style={{ padding: '4px 16px 14px' }}>
      <div style={{ fontSize: 13, color: muted }}>Boa tarde,</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Marina <span style={{ color: muted, fontWeight: 500, fontSize: 14 }}>· Consultora</span></div>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 110px' }}>
      {/* Hero operacional (sem financeiro) */}
      <div style={{
        background: card, border: `1px solid ${border}`,
        borderRadius: 18, padding: 18, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Operacional · hoje</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: accent, background: `color-mix(in oklab, ${accent} 18%, transparent)`, padding: '3px 8px', borderRadius: 999 }}>2 atrasadas</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>3</div>
            <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>entregas hoje</div>
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: accent }}>4</div>
            <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>agendadas</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, paddingTop: 12, borderTop: `1px solid ${border}` }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700 }}>6</div><div style={{ fontSize: 10, color: muted }}>OS abertas</div></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>1</div><div style={{ fontSize: 10, color: muted }}>aprovações</div></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700 }}>3</div><div style={{ fontSize: 10, color: muted }}>aguardando peça</div></div>
        </div>
      </div>

      {/* Pipeline distribution */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Pipeline</span>
          <span style={{ fontSize: 10, color: muted }}>onde estão as OS</span>
        </div>
        {STAGES.map(st => {
          const counts = { 'Recepção': 2, 'Funilaria': 1, 'Pintura': 1, 'Montagem': 0, 'Lavagem': 1, 'Entrega': 1 };
          const count = counts[st.name] || 0;
          const pct = (count / 6) * 100;
          return <div key={st.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 70, fontSize: 10, color: muted }}>{st.name}</span>
            <div style={{ flex: 1, height: 6, background: isDark ? '#1f1f24' : '#f0f0f4', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: st.color, borderRadius: 3 }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 14, textAlign: 'right' }}>{count}</span>
          </div>;
        })}
      </div>

      {/* Próximas entregas/agendamentos */}
      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '8px 4px 8px' }}>Próximas entregas</div>
      {SAMPLE_OS.slice(0, 3).map((os, i) => (
        <div key={os.id} style={{
          background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10, marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 38, padding: '4px 0', borderRadius: 8, textAlign: 'center',
            background: isDark ? '#1f1f24' : '#f0f0f4',
          }}>
            <div style={{ fontSize: 9, color: muted, fontWeight: 600 }}>{['HOJE','HOJE','AMANHÃ'][i]}</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Geist Mono', monospace" }}>{['14:30','17:00','09:00'][i]}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Plate value={os.plate} size={11} theme={theme}/>
            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{os.client}</div>
          </div>
        </div>
      ))}

      {/* Ações rápidas — foco em criação */}
      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '12px 4px 8px' }}>Atalhos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <button style={{ background: accent, border: 'none', color: '#fff', padding: '14px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
          <Ico.plus width="18" height="18"/>Nova OS
        </button>
        <button style={{ background: card, border: `1px solid ${border}`, color: fg, padding: '14px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
          <Ico.cal width="18" height="18"/>Agendar
        </button>
      </div>
    </div>

    <NavCWithHome theme={theme} accent={accent} active="home"/>
  </div>;
}

function HomeGerente({ theme='dark', accent='#ea0e03' }) {
  // É o HomeDashboard original, já completo
  return <HomeDashboard theme={theme} accent={accent}/>;
}

Object.assign(window, { HomeTecnico, HomeConsultor, HomeGerente });
