import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import { normalize } from '../../shared/filter.js';
const uf = Object.fromEntries(
  'acre:AC alagoas:AL amapa:AP amazonas:AM bahia:BA ceara:CE distrito.federal:DF espirito.santo:ES goias:GO maranhao:MA mato.grosso:MT mato.grosso.sul:MS mato.grosso.do.sul:MS minas.gerais:MG para:PA paraiba:PB parana:PR pernambuco:PE piaui:PI rio.janeiro:RJ rio.de.janeiro:RJ rio.grande.norte:RN rio.grande.do.norte:RN rio.grande.sul:RS rio.grande.do.sul:RS rondonia:RO roraima:RR santa.catarina:SC sao.paulo:SP sergipe:SE tocantins:TO'
    .split(' ')
    .map((x) => x.split(':')),
);
export const LEGAL_BASES = [
  {
    id: 'lei-eca',
    name: 'ECA · Estatuto da Criança e do Adolescente',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8069.htm',
    date: '1990-07-13',
    body: 'Lei nº 8.069/1990. Referência nacional sobre os direitos de crianças e adolescentes, incluindo o direito à educação. Abra o texto oficial para consultar a redação atual e suas alterações.',
    tags: ['ECA', 'Infância', 'Direitos'],
  },
  {
    id: 'lei-ldb',
    name: 'LDB · Diretrizes e Bases da Educação Nacional',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9394.htm',
    date: '1996-12-20',
    body: 'Lei nº 9.394/1996. Organiza a educação nacional, os níveis de ensino e os princípios aplicáveis aos profissionais da educação. O link leva ao texto oficial, com referências às alterações.',
    tags: ['LDB', 'Educação', 'Ensino'],
  },
  {
    id: 'lei-bncc',
    name: 'BNCC · Base Nacional Comum Curricular',
    url: 'https://basenacionalcomum.mec.gov.br/',
    date: '',
    body: 'Portal oficial do MEC para consultar a Base Nacional Comum Curricular, seus documentos e materiais de implementação. A consulta automática acompanha a disponibilidade e mudanças da página; não certifica a vigência de cada documento.',
    tags: ['BNCC', 'Currículo', 'MEC'],
  },
];
export const LEGISLATION_SOURCES = [
  ...LEGAL_BASES.map((x) => ({ ...x, intervalHours: 24, terms: x.url, maxItems: 1 })),
  {
    id: 'legis-ac',
    name: 'Legislação estadual · ALEAC',
    url: 'https://sapl.al.ac.leg.br/api/norma/normajuridica/?page_size=100&ordering=-ano,-numero&ementa__icontains=educa',
    terms: 'https://app.al.ac.leg.br/dados-abertos',
    intervalHours: 24,
    maxItems: 50,
  },
  {
    id: 'lexml',
    name: 'LexML · legislação federal e estadual',
    url: 'https://www.lexml.gov.br/busca/SRU?operation=searchRetrieve&version=1.1&query=educacao&maximumRecords=100&recordSchema=dc',
    terms:
      'https://www12.senado.leg.br/dados-abertos/legislativo/legislacao/acervo-do-portal-lexml',
    intervalHours: 24,
    maxItems: 50,
  },
];
const plain = (s) =>
  String(s || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const educational = (text) =>
  /educa|ensino|escola|docente|magisterio|professor|crianca|adolescente|curricul/.test(
    normalize(text),
  );
function law(data) {
  return {
    kind: 'content',
    data: {
      type: 'Legislação',
      country: 'BR',
      automatic: true,
      level: 'Todos',
      checkedAt: new Date().toISOString().slice(0, 10),
      attribution:
        'Metadados e referência oficial. Consulte a fonte para texto atualizado, vigência e revogações.',
      ...data,
    },
  };
}
export function parseLegislation(id, text) {
  const base = LEGAL_BASES.find((x) => x.id === id);
  if (base) {
    if (
      text.length < 500 ||
      /<title>[^<]*(?:verifica[çc][ãa]o de seguran[çc]a|access denied)/i.test(text)
    )
      throw new Error('Fonte oficial indisponível; referência anterior preservada.');
    return [
      law({
        title: base.name,
        body: base.body,
        summary: base.body,
        sourceUrl: base.url,
        sourceName:
          id === 'lei-bncc' ? 'Ministério da Educação' : 'Presidência da República / Planalto',
        sourceDate: base.date,
        scope: 'Nacional',
        sourceHash: createHash('sha256').update(plain(text)).digest('hex'),
        tags: base.tags,
        locationBasis: 'Abrangência nacional; não é uma notícia local.',
      }),
    ];
  }
  if (id === 'legis-ac') {
    const data = JSON.parse(text);
    if (!Array.isArray(data.results)) throw new Error('Resposta legislativa incompatível.');
    return data.results
      .filter((x) => educational(x.ementa + ' ' + x.indexacao) && x.id && x.ementa)
      .map((x) =>
        law({
          title: plain(x.__str__ || `Norma ${x.numero}/${x.ano}`).slice(0, 240),
          body: plain(x.ementa).slice(0, 12000),
          sourceName: 'Assembleia Legislativa do Acre',
          sourceUrl: `https://sapl.al.ac.leg.br/norma/${encodeURIComponent(x.id)}`,
          sourceDate: (x.data_publicacao || x.data || '').slice(0, 10),
          scope: 'Estadual',
          state: 'AC',
          tags: ['Legislação', 'Educação', 'AC'],
          locationBasis:
            'Norma estadual da Assembleia Legislativa do Acre. Ementa oficial; não é resumo produzido por IA.',
        }),
      );
  }
  if (id !== 'lexml') return null;
  if (/<!DOCTYPE|<html|verificação de segurança/i.test(text))
    throw new Error(
      'LexML não disponibilizou a API nesta consulta. Sem contornar verificações; cache preservado.',
    );
  const parsed = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true }).parse(text);
  const root = parsed.searchRetrieveResponse;
  if (!root || root.diagnostics) throw new Error('Resposta SRU indisponível ou incompatível.');
  const rows = [root.records?.record || []].flat();
  const values = (x) => [x || []].flat().map((v) => String(v?.['#text'] ?? v));
  return rows.flatMap((row) => {
    const dc = row.recordData?.dc || row.recordData;
    if (!dc) return [];
    const urn = values(dc.identifier).find((v) => v.startsWith('urn:lex:br'));
    if (
      !urn ||
      !/(?:federal|estadual|distrital):(?:lei|decreto|resolucao|portaria)/.test(urn) ||
      /projeto|municipal/.test(urn)
    )
      return [];
    const isFederal = urn.startsWith('urn:lex:br:federal:');
    const state = isFederal ? '' : uf[urn.split(':')[2]?.split(';')[1]];
    if (!isFederal && !state) return [];
    const title = plain(values(dc.title).join(' ')),
      body = plain(values(dc.description).join(' '));
    if (!educational(title + ' ' + body)) return [];
    return [
      law({
        title: title.slice(0, 240),
        body: body.slice(0, 12000),
        sourceName: 'LexML / órgãos públicos participantes',
        sourceUrl: 'https://www.lexml.gov.br/urn/' + urn,
        sourceDate: urn.match(/:(\d{4}-\d{2}-\d{2});/)?.[1] || '',
        scope: isFederal ? 'Nacional' : state === 'DF' ? 'Distrital' : 'Estadual',
        state: state || '',
        tags: ['Legislação', 'Educação', isFederal ? 'Nacional' : state],
        locationBasis:
          'Jurisdição extraída do identificador oficial URN. Não inclui projetos de lei nem normas municipais.',
      }),
    ];
  });
}
