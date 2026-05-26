/* Agenda / Calendar redesigns + FAB menu redesigns */

function AgendaV1({ theme='dark', accent='#ef4444' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f7f7f9';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const card = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';

  const days = Array.from({length: 31}, (_,i) => i+1);
  const offset = 5; // May 2026 starts on Friday — for grid pad
  const today = 9;

  return <div style={{ background: bg, color: fg, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '12px 16px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Agenda</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button style={{ background: 'transparent', border: 'none', color: fg, padding: 6, display:'flex' }}><Ico.back width="20" height="20"/></button>
          <span style={{ fontSize: 13, fontWeight: 600, padding: '0 8px' }}>Maio 2026</span>
          <button style={{ background: 'transparent', border: 'none', color: fg, padding: 6, display:'flex', transform:'rotate(180deg)' }}><Ico.back width="20" height="20"/></button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: muted, marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#3b82f6' }}/> Entrada
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10b981' }}/> Entrega
        </span>
      </div>
    </div>

    {/* Calendar grid */}
    <div style={{ padding: '0 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['D','S','T','Q','Q','S','S'].map((d,i) => (
          <div key={i} style={{ fontSize: 11, color: muted, textAlign: 'center', fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: offset }, (_,i) => <div key={'p'+i}/>)}
        {days.map(d => {
          const isToday = d === today;
          const hasEntrada = [5,12,18,22].includes(d);
          const hasEntrega = [5,15,28].includes(d);
          return <button key={d} style={{
            aspectRatio: '1/1.1', borderRadius: 10, border: 'none',
            background: isToday ? accent : 'transparent',
            color: isToday ? '#fff' : fg,
            position: 'relative', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            fontSize: 13, fontWeight: isToday ? 700 : 500, fontFamily: 'inherit',
            cursor: 'pointer',
          }}>
            <span>{d}</span>
            {(hasEntrada || hasEntrega) && <div style={{ display: 'flex', gap: 2 }}>
              {hasEntrada && <span style={{ width: 4, height: 4, borderRadius: 999, background: '#3b82f6' }}/>}
              {hasEntrega && <span style={{ width: 4, height: 4, borderRadius: 999, background: '#10b981' }}/>}
            </div>}
          </button>;
        })}
      </div>
    </div>

    {/* Today's events */}
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Hoje</div>
          <div style={{ fontSize: 12, color: muted }}>Sex 9 mai · 3 eventos</div>
        </div>
        <button style={{
          background: accent, border: 'none', color: '#fff',
          padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
        }}>+ Novo</button>
      </div>
      {[
        { time: '09:00', title: 'Entrada · Hyundai Creta', client: 'Tokio Marine', color: '#3b82f6', kind: 'Entrada' },
        { time: '14:30', title: 'Entrega · Fiat Punto', client: 'Thiago Souza', color: '#10b981', kind: 'Entrega' },
        { time: '16:00', title: 'Vistoria final · Onix', client: 'Bradesco', color: '#f59e0b', kind: 'Vistoria' },
      ].map((ev, i) => (
        <div key={i} style={{
          background: card, border: `1px solid ${border}`, borderRadius: 12,
          padding: 12, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 700 }}>{ev.time}</span>
            <span style={{ fontSize: 10, color: ev.color, fontWeight: 600, marginTop: 2 }}>{ev.kind}</span>
          </div>
          <div style={{ width: 2, alignSelf: 'stretch', background: ev.color, borderRadius: 1 }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.title}</div>
            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{ev.client}</div>
          </div>
          <Ico.chev width="16" height="16" style={{ color: muted }}/>
        </div>
      ))}
    </div>

    <BottomNav active="cal" accent={accent} theme={theme} style="floating"/>
  </div>;
}

/* FAB menu redesign */
function FabMenuV1({ theme='dark', accent='#ef4444' }) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0a0a0c' : '#f7f7f9';
  const fg = isDark ? '#f5f5f7' : '#0e0e10';
  const muted = isDark ? '#8b8b94' : '#6b7280';
  const sheet = isDark ? '#15151a' : '#fff';
  const border = isDark ? '#22222a' : '#eaeaef';

  return <div style={{ background: bg, color: fg, height: '100%', position: 'relative', overflow: 'hidden' }}>
    {/* dim background suggestion */}
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
    }}/>
    {/* sheet */}
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: sheet, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: '12px 16px 28px',
    }}>
      <div style={{ width: 40, height: 4, background: border, borderRadius: 999, margin: '0 auto 16px' }}/>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Criar</div>
      <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>O que você quer fazer agora?</div>

      {/* Big primary */}
      <button style={{
        width: '100%', background: accent, border: 'none', color: '#fff',
        padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
      }}>
        <div style={{
          width: 36, height: 36, background: 'rgba(255,255,255,.2)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}><Ico.plus width="20" height="20"/></div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div>Nova Ordem de Serviço</div>
          <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, marginTop: 2 }}>Atalho rápido — placa + cliente</div>
        </div>
      </button>

      {/* Secondary grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { icon: Ico.user, label: 'Novo Cliente', desc: 'Cadastrar' },
          { icon: Ico.car, label: 'Novo Veículo', desc: 'Adicionar' },
          { icon: Ico.cal, label: 'Agendar', desc: 'Entrada/Entrega' },
          { icon: Ico.cam, label: 'Checklist', desc: 'Para OS atual' },
        ].map(it => (
          <button key={it.label} style={{
            background: 'transparent', border: `1px solid ${border}`,
            padding: '12px', borderRadius: 12, color: fg, fontFamily: 'inherit',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: isDark ? '#1e1e26' : '#f1f1f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
              <it.icon width="18" height="18"/>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{it.label}</div>
            <div style={{ fontSize: 10, color: muted }}>{it.desc}</div>
          </button>
        ))}
      </div>
    </div>
  </div>;
}

Object.assign(window, { AgendaV1, FabMenuV1 });
