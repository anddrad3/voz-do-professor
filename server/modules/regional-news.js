import { XMLParser } from 'fast-xml-parser';
import { normalize } from '../../shared/filter.js';
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
export const REGION_CITIES = [
  'Franca',
  'Batatais',
  'Brodowski',
  'Buritizal',
  'Cristais Paulista',
  'Guará',
  'Igarapava',
  'Ipuã',
  'Itirapuã',
  'Ituverava',
  'Jeriquara',
  'Miguelópolis',
  'Nuporanga',
  'Orlândia',
  'Patrocínio Paulista',
  'Pedregulho',
  'Restinga',
  'Ribeirão Corrente',
  'Rifaina',
  'Sales Oliveira',
  'São Joaquim da Barra',
  'São José da Bela Vista',
];
const plain = (v) =>
  String(v || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const REGIONAL_SOURCES = [
  {
    id: 'de-franca',
    name: 'Unidade Regional de Ensino de Franca',
    url: 'https://defranca.educacao.sp.gov.br/feed/',
    terms: 'https://defranca.educacao.sp.gov.br/',
    host: 'defranca.educacao.sp.gov.br',
    regional: true,
  },
  {
    id: 'agencia-sp',
    name: 'Agência SP / Governo de São Paulo',
    url: 'https://www.agenciasp.sp.gov.br/feed/',
    terms: 'https://www.agenciasp.sp.gov.br/sobre/',
    host: 'www.agenciasp.sp.gov.br',
  },
];
export function newsPriority(data) {
  if (data.country && data.country !== 'BR') return 3;
  if (
    data.editorialPriority === 0 ||
    REGION_CITIES.some((c) => normalize(c) === normalize(data.city || ''))
  )
    return 0;
  const title = ' ' + normalize(data.title || '').replace(/[^a-z0-9 ]/g, ' ') + ' ';
  if (REGION_CITIES.some((c) => title.includes(' ' + normalize(c) + ' '))) return 0;
  return data.state === 'SP' ? 1 : 2;
}
export function regionalNews(xml, source, at = Date.now()) {
  if (/<!DOCTYPE/i.test(xml)) throw new Error('DTD não permitido');
  const raw = parser.parse(xml)?.rss?.channel?.item;
  if (!raw) throw new Error('Feed indisponível');
  return [raw].flat().flatMap((item) => {
    const title = plain(item.title),
      date = Date.parse(item.pubDate);
    if (!Number.isFinite(date) || date > at + 86400000 || date < at - 30 * 86400000) return [];
    const categories = [item.category || []].flat().map(plain).join(' ');
    if (
      !source.regional &&
      !/educa|escola|professor|docente|ensino|pedagog|estudant|magister|univers|vestibular/.test(
        normalize(title + ' ' + categories),
      )
    )
      return [];
    let url;
    try {
      url = new URL(item.link);
      if (url.protocol !== 'https:' || url.hostname !== source.host || url.username || url.password)
        return [];
    } catch {
      return [];
    }
    const titleWords = ' ' + normalize(title).replace(/[^a-z0-9 ]/g, ' ') + ' ';
    const city = REGION_CITIES.find((c) => titleWords.includes(' ' + normalize(c) + ' ')) || '';
    // Public headline metadata only: official origin is not a blanket copyright licence.
    return [
      {
        kind: 'content',
        sourceId: source.id,
        basis: title,
        data: {
          title: title.slice(0, 240),
          type: 'Notícia',
          body: '',
          country: 'BR',
          state: 'SP',
          city,
          editorialPriority: source.regional || city ? 0 : 1,
          sourceName: source.name,
          sourceUrl: url.href,
          sourceDate: new Date(date).toISOString().slice(0, 10),
          automatic: true,
          locationBasis: city
            ? 'Município citado no título.'
            : source.regional
              ? 'Fonte da região de Franca; município do fato não confirmado.'
              : 'Fonte estadual; município não confirmado.',
          attribution:
            'Resumo original limitado ao título do comunicado público, com fonte e link. Sem reprodução do artigo ou de fotografias.',
          tags: ['Educação', source.regional ? 'Franca e região' : 'São Paulo'],
        },
      },
    ];
  });
}
export function selectDailyNews(items, known = new Set(), at = Date.now()) {
  const urls = new Set(),
    titles = new Set();
  return items
    .filter((i) => i.kind === 'content' && i.data.type === 'Notícia')
    .filter((i) => {
      const d = Date.parse(i.data.sourceDate);
      return (
        Number.isFinite(d) &&
        d <= at + 86400000 &&
        d >= at - 30 * 86400000 &&
        !known.has(i.data.sourceUrl)
      );
    })
    .sort(
      (a, b) =>
        newsPriority(a.data) - newsPriority(b.data) ||
        b.data.sourceDate.localeCompare(a.data.sourceDate),
    )
    .filter((i) => {
      const title = normalize(i.data.title);
      if (urls.has(i.data.sourceUrl) || titles.has(title)) return false;
      urls.add(i.data.sourceUrl);
      titles.add(title);
      return true;
    })
    .slice(0, 20);
}
