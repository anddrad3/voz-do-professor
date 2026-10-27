export const AI_TOPICS = {
  jobs: 'Vagas de emprego',
  news: 'Notícias de educação',
  law: 'Direitos e legislação',
  salary: 'Piso salarial',
  contests: 'Concursos públicos',
  search: 'Pesquisar educação',
};
export const AI_ROLES = [
  'Professor',
  'Pedagogo',
  'Coordenador pedagógico',
  'Diretor escolar',
  'Auxiliar de educação',
  'Técnico em educação',
];
export const AI_LEVELS = [
  'Todos',
  'Educação Infantil',
  'Ensino Fundamental',
  'Ensino Médio',
  'Ensino Superior',
];
export const AI_NETWORKS = ['Todas', 'Municipal', 'Estadual', 'Federal', 'Privada'];
export const AI_ACTIONS = {
  overview: 'Ver oportunidades e informações',
  requirements: 'Conferir requisitos',
  deadlines: 'Ver prazos e inscrição',
  contacts: 'Ver canais oficiais de contato',
};
export const BRAZIL_STATES =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export function actionsForTopic(topic) {
  if (topic === 'news')
    return {
      overview: 'Principais notícias da região',
      requirements: 'Impacto para professores',
      deadlines: 'Novidades da última semana',
      contacts: 'Conferir comunicados oficiais',
    };
  if (topic === 'law')
    return {
      overview: 'Consultar direitos na região',
      requirements: 'ECA, LDB e BNCC',
      deadlines: 'Mudanças recentes na legislação',
      contacts: 'Encontrar textos oficiais',
    };
  if (topic === 'salary')
    return {
      overview: 'Consultar piso na minha região',
      requirements: 'Comparar rede e jornada',
      deadlines: 'Conferir reajustes e ano',
      contacts: 'Encontrar a norma oficial',
    };
  if (topic === 'search')
    return {
      overview: 'Pesquisar este assunto',
      requirements: 'Explicar o contexto',
      deadlines: 'Ver atualizações recentes',
      contacts: 'Encontrar fontes oficiais',
    };
  return AI_ACTIONS;
}
