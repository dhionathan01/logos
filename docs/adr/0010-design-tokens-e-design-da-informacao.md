# ADR-0010: Design tokens da AutoU e design da informação para gestão por exceção

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

O analista precisa olhar 100 incidentes e saber em milissegundos o que exige ação. A interface também precisa refletir a identidade visual da AutoU, extraída da landing page oficial: Figtree, navy `#031a2b`/`#02578a`, azul `#05a2f2`, laranja `#ec4e22`, âmbar `#fd9800`, além de vermelho e verde usados em indicadores.

Há um conflito: o **laranja da marca** é visualmente próximo do **vermelho de criticidade alta**. Se o laranja for a cor de ação principal, botões e alertas competem pela atenção.

## Decisão

**Tokens em duas camadas** (`frontend/src/styles/tokens.css`):
1. `--brand-*`: valores brutos da identidade, nunca usados direto pelos componentes.
2. Tokens semânticos (`--color-primary`, `--severity-high`, `--status-closed`...), redefinidos para os temas claro e escuro. Superfícies neutras são derivadas do navy com `color-mix`, sem introduzir cores fora da paleta.

**Papel das cores:**
- Ação primária em **navy/azul**; o **laranja** fica restrito à marca (logo, acentos).
- **Vermelho = Alta, âmbar = Média, azul = Baixa.** A cor nunca aparece sozinha: sempre vem com ícone e rótulo de texto (acessibilidade para daltonismo, WCAG 1.4.1).
- Verde só para "Fechado", que é a única boa notícia da tela.

**Design da informação:**
- A lista chega **ordenada pela API** por criticidade → status (o que exige ação primeiro) → mais antigo. O analista não precisa ordenar nada.
- **Barra de contadores** por criticidade no topo, que também funciona como filtro com um clique.
- Cada linha tem uma **faixa lateral colorida** pela criticidade, para varredura vertical, e **tempo aberto** em números tabulares, destacado quando um incidente de criticidade alta está aberto há mais de 30 minutos.
- **Gestão por exceção:** a visão padrão esconde os fechados; filtros vivem na URL (`?severity=high&category=road_block`), então dá para compartilhar uma visão e o botão voltar funciona.
- **Densidade:** linhas compactas (cerca de 56 px), para que uns 12 incidentes caibam na primeira dobra de um notebook. O raio de card da landing (32 px) foi reduzido para 16 px por esse motivo.

**Temas e movimento:** claro/escuro com preferência do sistema como padrão, aplicado antes da primeira pintura. Transições curtas (120–220 ms) e respeito a `prefers-reduced-motion`.

## Alternativas consideradas

- **Laranja como cor primária, fiel à landing:** a landing é marketing; o Logos é uma ferramenta operacional, e lá a cor precisa carregar significado.
- **Tabela ordenável pelo usuário:** mais flexível, mas transfere ao analista uma decisão de prioridade que o sistema pode tomar.
- **Biblioteca de componentes (MUI, Chakra):** traria o visual dela, não o da AutoU, e peso extra de bundle.

## Consequências

- Mudar a paleta ou criar um tema é editar um único arquivo.
- Componentes só referenciam tokens semânticos; um lint visual em revisão de PR verifica que não há hex soltos nos componentes.
