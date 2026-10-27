// Friendly version labels assigned to the actual Git milestones; these are not Git tags.
export const PLATFORM_VERSION = '3.0.0-pre.3';
export const RELEASES = [
  {
    version: PLATFORM_VERSION,
    date: '2026-10-27',
    title: 'Nova engenharia de dados',
    status: 'Em implantação',
    commits: [],
    changes: [
      'Histórico de versões no painel.',
      'Estatísticas públicas com gráficos por período e interpretação diária por IA de contagens reais.',
      'Consultas só contribuem para contadores coletivos por tema e estado com consentimento opcional; grupos menores que cinco ficam ocultos.',
      'Catálogo diário às 08h com até 20 notícias inéditas resumidas por Gemini; prioridade Franca e região, SP, Brasil e exterior.',
      'Consultas guiadas com busca Google para vagas, notícias, legislação, piso e concursos; ativação depende do plano pré-pago verificado.',
      'Consultas salvas em Meus Alertas, apenas no navegador por até 90 dias.',
      'Contabilidade de tokens, buscas e orçamento acumulado; limites persistentes, pausa pelo proprietário e nenhum aumento automático do orçamento.',
      'Exclusão definitiva de relatos com confirmação.',
      'Radar de Escolas preparado para uma nova fonte: filtros e localização preservados, coleta anterior removida.',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-10-26',
    title: 'Administração de qualquer lugar',
    status: 'Publicada',
    commits: ['87c9b47'],
    changes: [
      'Painel HTTPS acessível pelo celular.',
      'Senha, autenticador e códigos de recuperação.',
      'Limite persistente de tentativas e proteção das alterações.',
    ],
  },
  {
    version: '2.1.1',
    date: '2026-10-25',
    title: 'Acesso administrativo mais rápido',
    status: 'Histórica',
    commits: ['46c6243'],
    changes: ['Redução da demora na comunicação privada entre o computador e o servidor.'],
  },
  {
    version: '2.1.0',
    date: '2026-10-25',
    title: 'Primeira administração privada publicada',
    status: 'Histórica',
    commits: ['ec29128'],
    changes: [
      'Acesso pelo computador usando SSH.',
      'Acionamento automático do serviço após períodos sem visitas.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-10-25',
    title: 'Privacidade local e catálogo automático',
    status: 'Histórica',
    commits: ['45288ed'],
    changes: [
      'Remoção de contas de visitantes e envio de arquivos ao site.',
      'Formulários PDF, preferências e alertas no navegador.',
      'Fontes automáticas, grades adaptativas e modos claro/escuro.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-24',
    title: 'Primeira plataforma registrada',
    status: 'Histórica',
    commits: ['1454b5f'],
    changes: [
      'Estrutura inicial de notícias, direitos, escolas, oportunidades e relatos.',
      'Documentação dos 66 requisitos do PDF.',
    ],
  },
];
