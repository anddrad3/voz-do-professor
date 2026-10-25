export const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
export function distanceKm(a, b, c, d) {
  const r = Math.PI / 180,
    s =
      Math.sin(((c - a) * r) / 2) ** 2 +
      Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
}
export function opportunityStatus(
  item,
  today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }),
) {
  if (item.stage && item.stage !== 'Automático') return item.stage;
  if (!item.closes) return 'Consultar na fonte';
  if (item.opens && today < item.opens) return 'Futuro';
  return today <= item.closes ? 'Inscrições abertas' : 'Encerrado';
}
export function filterRecords(items, q = {}) {
  const terms = normalize(q.q).split(/\s+/).filter(Boolean);
  const radius = Number(q.radius) || 0;
  if (
    radius &&
    (q.lat == null ||
      q.lat === '' ||
      q.lng == null ||
      q.lng === '' ||
      !Number.isFinite(Number(q.lat)) ||
      !Number.isFinite(Number(q.lng)) ||
      Math.abs(Number(q.lat)) > 90 ||
      Math.abs(Number(q.lng)) > 180 ||
      radius < 0 ||
      radius > 500)
  )
    throw Object.assign(new Error('Informe coordenadas válidas para usar o filtro de distância.'), {
      status: 400,
    });
  return items
    .flatMap((item) => {
      const searchable = normalize(
        [
          item.title,
          {
            story: 'Relato',
            school: 'Instituição Escola',
            opportunity: 'Vaga Oportunidade',
            survey: 'Pesquisa',
          }[item.kind],
          item.type,
          item.scope,
          item.excerpt,
          item.body,
          item.summary,
          item.sourceName,
          item.country,
          item.city,
          item.state,
          item.discipline,
          item.education,
          item.topic,
          item.cnpj,
          item.cnae,
          item.company,
          ...(item.tags || []),
        ].join(' '),
      );
      if (!terms.every((t) => searchable.includes(t))) return [];
      for (const k of [
        'type',
        'scope',
        'country',
        'city',
        'state',
        'network',
        'discipline',
        'education',
        'topic',
      ]) {
        if (
          q[k] &&
          q[k] !== 'Todos' &&
          normalize(item[k] || (k === 'country' ? 'BR' : '')) !== normalize(q[k])
        )
          return [];
      }
      if (q.level && item.level !== 'Todos' && normalize(item.level) !== normalize(q.level))
        return [];
      if (q.cnae && !String(item.cnae || '').startsWith(String(q.cnae).replace(/\D/g, '')))
        return [];
      if (q.status && opportunityStatus(item) !== q.status) return [];
      if (q.salaryMin && (item.salary == null || item.salary < Number(q.salaryMin))) return [];
      let result = { ...item };
      if (radius) {
        if (item.lat == null || item.lng == null) return [];
        const distance = distanceKm(Number(q.lat), Number(q.lng), item.lat, item.lng);
        if (distance > radius) return [];
        result.distance = Math.round(distance * 10) / 10;
      }
      if (item.kind === 'opportunity') result.situation = opportunityStatus(item);
      return [result];
    })
    .sort((a, b) =>
      radius
        ? a.distance - b.distance
        : String(b.sourceDate || b.updatedAt || '').localeCompare(
            String(a.sourceDate || a.updatedAt || ''),
          ),
    );
}
