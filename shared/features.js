export const FEATURES = {
  content: 'Direitos e Notícias',
  school: 'Radar de Escolas',
  opportunity: 'Oportunidades',
  contests: 'Concursos públicos',
  statistics: 'Estatísticas públicas',
  voice: 'Relatos e formulários',
  survey: 'Pesquisas em PDF',
  alerts: 'Alertas locais',
  favorites: 'Favoritos locais',
  preferences: 'Preferências locais',
  search: 'Busca',
  audio: 'Leitura em voz alta',
  calendar: 'Calendário',
  theme: 'Alternar modo claro e escuro',
  navigation: 'Recolher e expandir o menu',
  geolocation: 'Localização automática',
  ai: 'Consultas individuais com IA',
  guide: 'Guia de uso em PDF',
  statisticsExport: 'Relatório estatístico em PDF',
  versions: 'Versões e mudanças públicas',
  viewModes: 'Alternar grade e lista',
  citations: 'Copiar citações',
};
export const FEATURE_HELP = {
  content: [
    'Conteúdo público',
    'Oculta Direitos e Notícias, suas publicações e consultas de notícias, legislação e piso. Os registros ficam guardados.',
  ],
  school: [
    'Conteúdo público',
    'Oculta o Radar de Escolas e seus filtros. A base de instituições continua em preparação.',
  ],
  opportunity: [
    'Conteúdo público',
    'Oculta a busca de vagas privadas e canais de candidatura. Concursos têm controle separado.',
  ],
  contests: [
    'Conteúdo público',
    'Oculta o catálogo e as consultas de concursos públicos. Não apaga os registros.',
  ],
  statistics: [
    'Conteúdo público',
    'Oculta os gráficos e interrompe novos contadores agregados. O histórico é preservado; o relatório depende desta ferramenta.',
  ],
  voice: [
    'Participação',
    'Oculta relatos públicos e a área de formulários de relato, sugestão e remoção. Os dados permanecem guardados.',
  ],
  survey: [
    'Participação',
    'Oculta instrumentos de pesquisa em PDF já publicados. Não altera os relatos nem coleta respostas online.',
  ],
  preferences: [
    'Minha Sala de Aula',
    'Oculta edição do nome, foto local, região e interesses, e as saudações personalizadas. Favoritos e consultas têm controles separados.',
  ],
  favorites: [
    'Minha Sala de Aula',
    'Oculta marcadores e publicações salvas. Não apaga as cópias que já estão no navegador.',
  ],
  alerts: [
    'Minha Sala de Aula',
    'Oculta novidades regionais e consultas salvas, incluindo os botões para salvar e apagar chats.',
  ],
  search: [
    'Navegação e leitura',
    'Oculta a busca geral e bloqueia consultas de IA pela busca. Os filtros dentro de cada área permanecem disponíveis.',
  ],
  theme: [
    'Navegação e leitura',
    'Oculta o botão de tema. A preferência visual já escolhida continua válida, sem afetar o conteúdo.',
  ],
  navigation: [
    'Navegação e leitura',
    'Oculta apenas a seta de recolher. O menu fica aberto para não impedir acesso às áreas.',
  ],
  viewModes: [
    'Navegação e leitura',
    'Oculta o seletor de grade/lista e mantém a grade adaptativa padrão.',
  ],
  audio: [
    'Navegação e leitura',
    'Oculta a leitura em voz alta. A disponibilidade da voz depende do navegador.',
  ],
  citations: [
    'Navegação e leitura',
    'Oculta o botão Copiar citação. Fontes, créditos e atribuições obrigatórias continuam visíveis.',
  ],
  geolocation: [
    'Navegação e leitura',
    'Oculta os botões que pedem GPS. País, estado e cidade continuam editáveis manualmente.',
  ],
  calendar: [
    'Navegação e leitura',
    'Oculta exportação de prazos em .ics nos detalhes das oportunidades, sem alterar datas e editais.',
  ],
  ai: [
    'Consultas e documentos',
    'Bloqueia novas consultas individuais em todas as áreas. Filtros do catálogo e atualizações diárias continuam funcionando. Para pausar toda a IA, use Automação.',
  ],
  guide: [
    'Consultas e documentos',
    'Oculta links e bloqueia o download do guia de uso. Não desativa formulários de relatos ou termos.',
  ],
  statisticsExport: [
    'Consultas e documentos',
    'Oculta a geração do PDF dos gráficos filtrados. Depende de Estatísticas públicas estar habilitada.',
  ],
  versions: [
    'Consultas e documentos',
    'Oculta o histórico público. O histórico do proprietário continua disponível no painel.',
  ],
};
export const defaultFeatures = () =>
  Object.fromEntries(Object.keys(FEATURES).map((k) => [k, true]));
export const featureForKind = (k) => (k === 'story' ? 'voice' : k);
