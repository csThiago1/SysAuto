/* Slim preview — só telas aprovadas */

function FrameWrap({ children, height = 780 }) {
  return <div style={{ height, width: 360, position: 'relative', borderRadius: 36, overflow: 'hidden', background: '#000', border: '1px solid #2a2a30' }}>
    {children}
  </div>;
}

const ACCENT = '#ea0e03';
const THEME = 'dark';

function App() {
  return <DesignCanvas
    title="DSCAR Mobile · Telas aprovadas"
    subtitle="10 telas finais para handoff · vermelho #ea0e03 · Montserrat + Rajdhani"
  >
    <DCSection id="lista" title="① Lista de OS · V6c refinada">
      <DCArtboard id="lista-os" label="Lista de OS · V6c (logo + saudação + busca + chips + pipeline mini)" width={360} height={780}>
        <FrameWrap><ListV6c_Refined theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
    </DCSection>

    <DCSection id="inicio" title="② Início · 3 visões por papel">
      <DCArtboard id="home-tec" label="TÉCNICO · minha fila + comissão" width={360} height={780}>
        <FrameWrap><HomeTecnico theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
      <DCArtboard id="home-con" label="CONSULTOR · operacional + agendamentos (sem $)" width={360} height={780}>
        <FrameWrap><HomeConsultor theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
      <DCArtboard id="home-ger" label="GERENTE · faturamento + tudo" width={360} height={780}>
        <FrameWrap><HomeGerente theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
    </DCSection>

    <DCSection id="detalhe" title="③ Detalhe da OS · 4 abas">
      <DCArtboard id="d-geral" label="Geral" width={360} height={780}>
        <FrameWrap><DetailGeralV1 theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
      <DCArtboard id="d-pecas" label="Peças" width={360} height={780}>
        <FrameWrap><DetailPecasV1 theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
      <DCArtboard id="d-fotos" label="Fotos" width={360} height={780}>
        <FrameWrap><DetailFotosV1 theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
      <DCArtboard id="d-hist" label="Histórico" width={360} height={780}>
        <FrameWrap><DetailHistoricoV1 theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
    </DCSection>

    <DCSection id="agenda-fab" title="④ Agenda + FAB de criação rápida">
      <DCArtboard id="agenda" label="Agenda · calendário compacto + lista do dia" width={360} height={780}>
        <FrameWrap><AgendaV1 theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
      <DCArtboard id="fab" label="FAB · bottom sheet com Nova OS / Agendamento / Cliente" width={360} height={780}>
        <FrameWrap><FabMenuV1 theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
    </DCSection>

    <DCSection id="nav" title="⑤ Navbar · variação C (referência)">
      <DCArtboard id="nav-c" label="Nav C · 4 itens (Início · OS · Agenda · Mais) + FAB destacado" width={360} height={780}>
        <FrameWrap><NavC theme={THEME} accent={ACCENT}/></FrameWrap>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
