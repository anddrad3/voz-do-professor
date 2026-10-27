export const FEATURES = {
  content: 'Direitos e Notícias',
  school: 'Radar de Escolas',
  opportunity: 'Oportunidades',
  contests: 'Concursos públicos',
  voice: 'Relatos e formulários',
  survey: 'Pesquisas em PDF',
  alerts: 'Alertas locais',
  favorites: 'Favoritos locais',
  preferences: 'Preferências locais',
  search: 'Busca',
  map: 'Mapa interativo',
  audio: 'Leitura em voz alta',
  calendar: 'Calendário',
};
export const defaultFeatures = () =>
  Object.fromEntries(Object.keys(FEATURES).map((k) => [k, true]));
export const featureForKind = (k) => (k === 'story' ? 'voice' : k);
