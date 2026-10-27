import { XMLParser } from 'fast-xml-parser';
import { createHash, randomUUID } from 'node:crypto';
import { recordSchemas } from '../domain.js';
import { normalize } from '../../shared/filter.js';
import { now } from '../db.js';
import { LEGAL_BASES, LEGISLATION_SOURCES, parseLegislation } from './legislation.js';
import { ebcExcerpt, enrichEbc, pruneMedia } from './news-media.js';
const parser = new XMLParser({ ignoreAttributes: false, processEntities: true });
export const SOURCES = [
  ...LEGISLATION_SOURCES,
  {
    id: 'ebc',
    name: 'Agência Brasil / EBC',
    url: 'https://agenciabrasil.ebc.com.br/rss/educacao/feed.xml',
    terms: 'https://agenciabrasil.ebc.com.br/sobre',
    intervalHours: 6,
  },
  {
    id: 'govuk',
    name: 'Department for Education / GOV.UK',
    url: 'https://www.gov.uk/api/search.json?filter_organisations=department-for-education&filter_format=news_story&order=-public_timestamp&count=30&fields=title,link,public_timestamp',
    terms: 'https://www.gov.uk/help/reuse-govuk-content',
    intervalHours: 6,
  },
  {
    id: 'jobicy',
    name: 'Jobicy',
    url: 'https://jobicy.com/api/jobs?count=200&industry=education',
    terms: 'https://github.com/Jobicy/remote-jobs-api',
    intervalHours: 6,
  },
  {
    id: 'remotive',
    name: 'Remotive',
    url: 'https://remotive.com/api/remote-jobs',
    terms: 'https://github.com/remotive-com/remote-jobs-api',
    intervalHours: 6,
  },
  {
    id: 'gdelt',
    name: 'GDELT',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=(education%20OR%20teacher%20OR%20professor)%20sourcelang:portuguese&mode=artlist&format=json&maxrecords=100&timespan=1d&sort=datedesc',
    terms: 'https://www.gdeltproject.org/about.html',
    intervalHours: 6,
  },
];
export async function boundedFetch(
  url,
  { fetcher = fetch, maxBytes = 12 * 1024 * 1024, timeout = 20000 } = {},
) {
  const r = await fetcher(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      'User-Agent': 'VozDoProfessor/3.0',
      Accept: 'application/json, application/rss+xml, application/xml;q=0.9',
    },
    redirect: 'error',
  });
  if (!r.ok) throw new Error(`Fonte respondeu HTTP ${r.status}`);
  const length = Number(r.headers.get('content-length') || 0);
  if (length > maxBytes) throw new Error('Resposta excedeu limite de tamanho.');
  const chunks = [];
  let size = 0;
  for await (const chunk of r.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Resposta excedeu limite de tamanho.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
const clean = (s) =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const safe = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
  } catch {
    return '';
  }
};
const day = (s) => {
  const t = Date.parse(s);
  return Number.isFinite(t)
    ? new Date(t).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
};
const ufNames = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};
const phrase = (text, word) =>
  (' ' + normalize(text).replace(/[^a-z0-9]+/g, ' ') + ' ').includes(
    ' ' + normalize(word).replace(/[^a-z0-9]+/g, ' ') + ' ',
  );
export function locateTitle(title, cities = []) {
  const states = Object.entries(ufNames).filter(([uf, name]) =>
    uf === 'PA' ? /(^|[^\p{L}])pará(?=$|[^\p{L}])/iu.test(title) : phrase(title, name),
  );
  let matched = cities.filter((c) => c.name.length >= 5 && phrase(title, c.name));
  if (states.length === 1) matched = matched.filter((c) => c.state === states[0][0]);
  if (matched.length === 1)
    return {
      city: matched[0].name,
      state: matched[0].state,
      locationBasis: 'Local citado no título; correspondência textual com municípios IBGE, sem IA.',
    };
  return {
    city: '',
    state: states.length === 1 ? states[0][0] : '',
    locationBasis:
      states.length === 1
        ? 'Estado citado no título.'
        : 'Localidade não identificada sem ambiguidade.',
  };
}
export function category(title) {
  const t = normalize(title);
  if (/piso (salarial|do magisterio)|piso.*professor/.test(t)) return 'Piso salarial';
  if (/plano de carreira|progressao.*docente/.test(t)) return 'Plano de carreira';
  if (/conselho.*educacao|\bcne\b/.test(t)) return 'Conselho de educação';
  if (/\blei\b|\bdecreto\b|\bresolucao\b|\bportaria\b/.test(t)) return 'Legislação';
  return 'Notícia';
}
function news(title, url, date, source, country, cities = [], extra = {}) {
  return {
    kind: 'content',
    data: {
      title: clean(title).slice(0, 240),
      type: category(title),
      sourceName: source,
      sourceUrl: safe(url),
      sourceDate: day(date),
      country,
      automatic: true,
      attribution: `Fonte: ${source}. Título e link; texto integral no site original.`,
      body: `Publicado por ${source}. Acesse a fonte para ler a matéria completa.`,
      level: 'Todos',
      ...(country === 'BR'
        ? locateTitle(title, cities)
        : { locationBasis: 'País da fonte; não afirma o local do acontecimento.' }),
      ...extra,
    },
  };
}
const country = (s) => {
  const n = normalize(s);
  return (
    {
      brazil: 'BR',
      brasil: 'BR',
      uk: 'GB',
      'united kingdom': 'GB',
      usa: 'US',
      'united states': 'US',
      portugal: 'PT',
      canada: 'CA',
      australia: 'AU',
      india: 'IN',
      germany: 'DE',
      france: 'FR',
      spain: 'ES',
      anywhere: 'GLOBAL',
      worldwide: 'GLOBAL',
      global: 'GLOBAL',
    }[n] || 'ZZ'
  );
};
export function parseSource(id, text, cities = []) {
  if (LEGISLATION_SOURCES.some((s) => s.id === id)) return parseLegislation(id, text);
  if (id === 'ebc') {
    if (/<!DOCTYPE/i.test(text)) throw new Error('DTD não permitido.');
    const items = parser.parse(text)?.rss?.channel?.item;
    if (!items) throw new Error('Feed RSS sem itens.');
    return [items]
      .flat()
      .map((i) =>
        news(i.title, i.link, i.pubDate, 'Agência Brasil / EBC', 'BR', cities, ebcExcerpt(i)),
      );
  }
  const data = JSON.parse(text);
  if (id === 'govuk')
    return (data.results || []).map((i) =>
      news(
        i.title,
        'https://www.gov.uk' + i.link,
        i.public_timestamp,
        'Department for Education / GOV.UK',
        'GB',
        [],
        { attribution: 'GOV.UK / Department for Education. Open Government Licence v3.0.' },
      ),
    );
  if (id === 'gdelt')
    return (data.articles || []).map((i) =>
      news(
        i.title,
        i.url,
        i.seendate?.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'),
        i.domain || 'Fonte indexada',
        country(i.sourcecountry),
        cities,
        {
          attribution:
            'Metadados GDELT (gdeltproject.org); direitos da matéria pertencem à fonte original.',
        },
      ),
    );
  const jobs = data.jobs || [];
  return jobs
    .filter(
      (j) =>
        id === 'jobicy' ||
        /teacher|professor|educator|instructional|curriculum|tutor|pedagog|education|learning designer/i.test(
          j.title || '',
        ),
    )
    .map((j) => {
      const company = clean(j.companyName || j.company_name);
      const title = clean(j.jobTitle || j.title);
      const geo = clean(j.jobGeo || j.candidate_required_location || '');
      return {
        kind: 'opportunity',
        data: {
          title: title.slice(0, 240),
          company: company.slice(0, 240),
          body: `${company}. Elegibilidade geográfica informada pela fonte: ${geo || 'consultar anúncio'}. Confira condições e disponibilidade no anúncio original.`,
          country: country(geo),
          city: '',
          state: '',
          type: 'Seleção privada',
          discipline: /teacher|professor|tutor/i.test(title) ? 'Docência' : 'Educação e formação',
          level: 'Todos',
          education: 'Consultar anúncio',
          salary:
            j.salaryCurrency === 'BRL' && Number.isFinite(Number(j.annualSalaryMin))
              ? Number(j.annualSalaryMin) / 12
              : null,
          opens: '',
          closes: '',
          requirements: 'Consulte requisitos, jornada, moeda e remuneração no anúncio original.',
          sourceName: id === 'jobicy' ? 'Jobicy' : 'Remotive',
          sourceUrl: safe(j.url),
          registrationUrl: safe(j.url),
          sourceDate: day(j.pubDate || j.publication_date),
          automatic: true,
          attribution: `Fonte: ${id === 'jobicy' ? 'Jobicy' : 'Remotive'} · ${company}. Sem garantia de contratação.`,
          locationBasis: `Elegibilidade: ${geo || 'não informada'}; sem coordenadas verificadas.`,
        },
      };
    });
}
export function saveAutomatic(db, kind, input, source) {
  if (!input.sourceUrl || input.title.length < 3) return false;
  const data = recordSchemas[kind].parse(input),
    id =
      'auto-' +
      createHash('sha256')
        .update(source + '|' + data.sourceUrl)
        .digest('hex')
        .slice(0, 24);
  const prev = db.prepare('SELECT data,status FROM records WHERE id=?').get(id);
  if (prev?.status === 'archived') return false;
  const serialized = JSON.stringify(data);
  if (prev?.data === serialized) return false;
  db.prepare(
    `INSERT INTO records(id,kind,data,status,reviewer,updated_at) VALUES(?,?,?,'published',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,revision=records.revision+1`,
  ).run(id, kind, serialized, 'Importação automática: ' + source, now());
  return true;
}
export function createAutomation(db, { fetcher = fetch } = {}) {
  let busy = false,
    stopped = false,
    timer;
  let cityCache = [];
  async function cities() {
    const key = 'ibge-cities-v2',
      old = db.prepare('SELECT value FROM metadata WHERE key=?').get(key);
    if (old) {
      const cached = JSON.parse(old.value);
      cityCache = cached.items;
      if (Date.now() - cached.at < 30 * 86400000) return cityCache;
    }
    try {
      const items = JSON.parse(
        await boundedFetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios', {
          fetcher,
          maxBytes: 8 * 1024 * 1024,
        }),
      );
      cityCache = items
        .map((c) => ({
          name: c.nome,
          state:
            c.microrregiao?.mesorregiao?.UF?.sigla ||
            c['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ||
            '',
        }))
        .filter((c) => c.state);
      db.prepare(
        'INSERT INTO metadata VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      ).run(key, JSON.stringify({ at: Date.now(), items: cityCache }));
    } catch {}
    return cityCache;
  }
  async function run() {
    if (busy || stopped) return;
    busy = true;
    try {
      // Official reference cards remain useful when an origin blocks automated checks.
      // They do not claim a successful check or a current legal status.
      for (const base of LEGAL_BASES) {
        if (
          !db
            .prepare(
              "SELECT 1 FROM records WHERE kind='content' AND json_extract(data,'$.sourceUrl')=?",
            )
            .get(base.url)
        ) {
          saveAutomatic(
            db,
            'content',
            {
              title: base.name,
              type: 'Legislação',
              body: base.body,
              summary: base.body,
              sourceUrl: base.url,
              sourceName:
                base.id === 'lei-bncc'
                  ? 'Ministério da Educação'
                  : 'Presidência da República / Planalto',
              sourceDate: base.date,
              scope: 'Nacional',
              country: 'BR',
              tags: base.tags,
              automatic: true,
              attribution:
                'Referência oficial. Consulte o documento de origem; a checagem automática pode estar indisponível.',
              locationBasis: 'Abrangência nacional.',
            },
            base.id,
          );
        }
      }
      await cities();
      for (const source of SOURCES) {
        if (stopped) break;
        const last = db
          .prepare('SELECT started_at FROM imports WHERE source=? ORDER BY started_at DESC LIMIT 1')
          .get(source.id);
        if (last && Date.now() - Date.parse(last.started_at) < source.intervalHours * 3600000)
          continue;
        const id = randomUUID();
        db.prepare(
          'INSERT INTO imports(id,source,started_at,status,summary) VALUES(?,?,?,?,?)',
        ).run(id, source.id, now(), 'running', '{}');
        try {
          const text = await boundedFetch(source.url, {
            fetcher,
            timeout: source.id === 'gdelt' ? 12000 : 20000,
          });
          const items = parseSource(source.id, text, cityCache);
          if (!items.length)
            throw new Error('Fonte sem itens nesta consulta; cache anterior preservado.');
          let updated = 0,
            skipped = 0;
          for (const item of items.slice(0, source.maxItems || 30)) {
            try {
              if (source.id === 'ebc' && process.env.NEWS_MEDIA !== 'false') {
                try {
                  await enrichEbc(item, { fetcher, fetchText: boundedFetch });
                } catch {
                  /* Text and source remain usable without a photo. */
                }
              }
              if (saveAutomatic(db, item.kind, item.data, source.id)) updated++;
              else skipped++;
            } catch {
              skipped++;
            }
          }
          db.prepare('UPDATE imports SET finished_at=?,status=?,summary=? WHERE id=?').run(
            now(),
            'completed',
            JSON.stringify({ received: items.length, updated, skipped }),
            id,
          );
        } catch (error) {
          db.prepare('UPDATE imports SET finished_at=?,status=?,summary=? WHERE id=?').run(
            now(),
            'failed',
            JSON.stringify({ error: error.message }),
            id,
          );
        }
      }
      await pruneMedia(db);
      // Bounded catalog and licensed photo cache; no visitor data or full article storage.
      db.prepare(
        "DELETE FROM records WHERE id IN (SELECT id FROM records WHERE id LIKE 'auto-%' ORDER BY updated_at DESC LIMIT -1 OFFSET 1500)",
      ).run();
      db.prepare(
        "DELETE FROM records WHERE id LIKE 'auto-%' AND kind='opportunity' AND json_extract(data,'$.sourceDate') < date('now','-45 days')",
      ).run();
      db.prepare(
        'DELETE FROM imports WHERE id NOT IN (SELECT id FROM imports ORDER BY started_at DESC LIMIT 100)',
      ).run();
    } finally {
      busy = false;
    }
  }
  return {
    sources: SOURCES,
    run,
    start() {
      void run();
      timer = setInterval(run, 3600000);
      timer.unref();
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
