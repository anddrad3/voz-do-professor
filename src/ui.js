import {
  createIcons,
  House,
  Newspaper,
  MapPinned,
  BriefcaseBusiness,
  MessagesSquare,
  Bell,
  UserRound,
  ShieldCheck,
  Search,
  Sun,
  Moon,
  Settings2,
  Inbox,
  Info,
  ArrowUpRight,
  BookmarkCheck,
  Bookmark,
  Play,
  Copy,
  Compass,
  SlidersHorizontal,
  CalendarDays,
  MapPin,
  LocateFixed,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CalendarPlus,
  MessageSquarePlus,
  ChartNoAxesCombined,
  Download,
  Printer,
  LogOut,
  Database,
  Fingerprint,
  HeartHandshake,
  UserRoundCheck,
  Plus,
  X,
  Square,
  School,
} from 'lucide';
const icons = {
  House,
  Newspaper,
  MapPinned,
  BriefcaseBusiness,
  MessagesSquare,
  Bell,
  UserRound,
  ShieldCheck,
  Search,
  Sun,
  Moon,
  Settings2,
  Inbox,
  Info,
  ArrowUpRight,
  BookmarkCheck,
  Bookmark,
  Play,
  Copy,
  Compass,
  SlidersHorizontal,
  CalendarDays,
  MapPin,
  LocateFixed,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CalendarPlus,
  MessageSquarePlus,
  ChartNoAxesCombined,
  Download,
  Printer,
  LogOut,
  Database,
  Fingerprint,
  HeartHandshake,
  UserRoundCheck,
  Plus,
  X,
  Square,
  School,
};
export const h = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const icon = (name) => `<i data-lucide="${h(name)}" aria-hidden="true"></i>`;
export const refreshIcons = () => createIcons({ icons });
export const fmtDate = (v) =>
  v
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
        new Date(v.length === 10 ? v + 'T12:00:00Z' : v),
      )
    : 'Não informado';
export const money = (v) =>
  v == null
    ? 'Não informada'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
export const empty = (
  title = 'Nenhum resultado por aqui',
  body = 'Tente ajustar os filtros ou volte depois para acompanhar novas publicações.',
) => `<div class="empty">${icon('inbox')}<h3>${h(title)}</h3><p>${h(body)}</p></div>`;
export const heading = (eyebrow, title, subtitle, actions = '') =>
  `<div class="page-head"><div><div class="eyebrow"><span class="live-dot"></span>${h(eyebrow)}</div><h1>${h(title)}</h1><p>${h(subtitle)}</p></div>${actions}</div>`;
export const notice = (text) => `<div class="notice">${icon('info')}<span>${h(text)}</span></div>`;
export const field = (name, label, value = '', type = 'text', extra = '') =>
  `<label class="field">${h(label)}<input name="${h(name)}" type="${h(type)}" value="${h(value)}" ${extra}></label>`;
export const textarea = (name, label, value = '', extra = '') =>
  `<label class="field wide">${h(label)}<textarea name="${h(name)}" ${extra}>${h(value)}</textarea></label>`;
export const select = (name, label, options, value = '', blank = true) =>
  `<label class="field">${h(label)}<select name="${h(name)}" aria-label="${h(label)}">${blank ? '<option value="">Todos</option>' : ''}${options
    .filter((o) => !blank || (Array.isArray(o) ? o[0] : o) !== 'Todos')
    .map((o) => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return `<option value="${h(v)}" ${String(v) === String(value) ? 'selected' : ''}>${h(t)}</option>`;
    })
    .join('')}</select></label>`;
export const check = (name, label, checked = false) =>
  `<label class="check"><input type="checkbox" name="${h(name)}" ${checked ? 'checked' : ''}><span>${h(label)}</span></label>`;
export const safeUrl = (value) => {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) ? h(u.href) : '';
  } catch {
    return '';
  }
};
export const external = (url, label) =>
  safeUrl(url)
    ? `<a class="button" href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${h(label)}${icon('arrow-up-right')}</a>`
    : '';
export const detailUrl = (r) => `#/detalhe/${encodeURIComponent(r.id)}`;
export const demo = (r) => (r.demo ? '<span class="badge demo">Demonstração</span>' : '');
export function card(r, ctx) {
  const saved = ctx.favorites.has(r.id);
  const kindIcon = {
    content: 'newspaper',
    school: 'school',
    opportunity: 'briefcase-business',
    survey: 'messages-square',
  }[r.kind];
  const info =
    r.kind === 'school'
      ? `${r.city} · ${r.state} · ${r.network}`
      : r.kind === 'opportunity'
        ? `${r.discipline} · ${r.city} / ${r.state}`
        : r.sourceName || r.topic;
  return `<article class="card" data-record="${h(r.id)}"><div class="meta"><span class="source-icon">${icon(kindIcon)}</span><span>${h(info)}</span>${demo(r)}</div><h3><a href="${detailUrl(r)}">${h(r.title)}</a></h3><p class="body">${h((r.body || r.purpose || r.address || '').slice(0, 420))}</p>${r.kind === 'opportunity' ? `<div class="tags"><span class="tag accent">${h(r.situation || 'Consultar prazos')}</span><span class="tag">Até ${fmtDate(r.closes)}</span></div><p class="small-text">Remuneração: ${money(r.salary)}</p>` : ''}${r.kind === 'school' ? `<div class="tags"><span class="tag">${h(r.network)}</span>${r.distance != null ? `<span class="tag accent">${h(r.distance)} km</span>` : ''}<span class="tag">${h(r.crosscheck)}</span></div>` : ''}${r.kind === 'content' ? `<div class="tags"><span class="tag accent">${h(r.type)}</span>${(r.tags || []).map((t) => `<span class="tag">${h(t)}</span>`).join('')}</div>` : ''}<div class="card-footer">${r.kind === 'content' ? `<button class="button small" data-action="audio" data-id="${h(r.id)}" aria-label="Ouvir ${h(r.title)}">${icon('play')}<span>Ouvir</span></button>` : `<a class="button small" href="${detailUrl(r)}">${r.kind === 'survey' ? 'Participar' : 'Ver detalhes'}${icon('arrow-up-right')}</a>`}<div class="actions"><button class="icon-button" data-action="favorite" data-id="${h(r.id)}" aria-label="${saved ? 'Remover dos' : 'Adicionar aos'} favoritos" aria-pressed="${saved}">${icon(saved ? 'bookmark-check' : 'bookmark')}</button>${r.kind === 'content' ? `<button class="button small ghost" data-action="citation" data-id="${h(r.id)}">${icon('copy')}Citar</button>` : ''}</div></div></article>`;
}
export function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? '');
            if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(';'),
      )
      .join('\r\n')
  );
}
export function dialog(title, body) {
  document.querySelector('#dialog-content').innerHTML =
    `<div class="dialog-head"><h2 id="dialog-title">${h(title)}</h2><button data-action="close-dialog" class="icon-button" aria-label="Fechar">${icon('x')}</button></div>${body}`;
  document.querySelector('#dialog').showModal();
  refreshIcons();
}
let toastTimer;
export function toast(text) {
  clearTimeout(toastTimer);
  const box = document.querySelector('#toast');
  box.textContent = text;
  box.hidden = false;
  toastTimer = setTimeout(() => (box.hidden = true), 6000);
}
