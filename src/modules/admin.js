import '../styles.css';
import {
  h,
  heading,
  field,
  textarea,
  check,
  select,
  notice,
  toast,
  refreshIcons,
  dialog,
  empty,
  external,
} from '../ui.js';
import { FEATURES } from '../../shared/features.js';
let session = null,
  secondFactorRequired = false,
  csrf = null,
  tab = 'story',
  items = [],
  editing = null,
  config = null;
async function request(path, body, method = 'POST') {
  const r = await fetch(`${import.meta.env.BASE_URL}api/admin${path}`, {
    method: body === undefined ? 'GET' : method,
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let value;
  try {
    value = await r.json();
  } catch {
    throw new Error('Painel indisponível. Confira sua conexão e tente novamente.');
  }
  if (!r.ok) throw new Error(value.error || 'Operação recusada.');
  return value;
}
const tabs = [
  ['story', 'Relatos'],
  ['features', 'Ferramentas'],
  ['automation', 'Automação'],
  ['content', 'Notícias e direitos'],
  ['school', 'Instituições'],
  ['opportunity', 'Oportunidades'],
  ['survey', 'Pesquisas'],
];
function editor(kind, r = {}) {
  if (kind === 'story')
    return `<article class="card"><h2>${r.id ? 'Editar' : 'Adicionar'} relato autorizado</h2>${notice('Copie apenas o texto que será público. Não cadastre e-mail, PDF recebido ou contato do professor. O nome é opcional; marque anônimo quando solicitado.')}<form data-form="story" class="stack">${field('title', 'Título', r.title || '', 'text', 'required maxlength="240"')}${textarea('body', 'Relato público', r.body || '', 'required maxlength="12000"')}${field('author', 'Nome público (opcional)', r.author || '')}${check('anonymous', 'Publicar como anônimo', r.anonymous !== false)}${check('consent', 'Recebi autorização explícita para publicar este relato', r.consent === true)}<div class="form-actions"><button class="button primary">Salvar rascunho</button><button type="button" class="button" data-action="cancel">Cancelar</button></div></form></article>`;
  const data = Object.fromEntries(
    Object.entries(r).filter(
      ([key]) =>
        ![
          'id',
          'kind',
          'status',
          'reviewer',
          'reviewedAt',
          'updatedAt',
          'firstPublishedAt',
          'revision',
          'demo',
        ].includes(key),
    ),
  );
  return `<article class="card"><h2>Editar registro</h2><p>As notícias, vagas e instituições são atualizadas automaticamente. Este editor serve para correções excepcionais.</p><form data-form="record" class="stack">${textarea('json', 'Dados públicos (JSON)', JSON.stringify(data, null, 2), 'required rows="18"')}<button class="button primary">Salvar rascunho</button><button type="button" class="button" data-action="cancel">Cancelar</button></form></article>`;
}
async function render() {
  const main = document.querySelector('#main');
  if (!session) {
    main.innerHTML = `<article class="card reading"><h2>Acesso do proprietário</h2><p>${secondFactorRequired ? 'Entre com sua senha e o código de seis dígitos do aplicativo autenticador.' : 'Entre com sua senha de proprietário.'}</p><form data-form="login" class="stack">${field('password', 'Senha do painel', '', 'password', 'required autocomplete="current-password"')}${secondFactorRequired ? field('code', 'Código do autenticador ou de recuperação', '', 'text', 'required autocomplete="one-time-code" autocapitalize="off" spellcheck="false" maxlength="64"') + '<p class="muted">Sem acesso ao autenticador? Use um dos códigos de recuperação que você guardou. Cada código de recuperação funciona uma única vez.</p>' : ''}<button class="button primary">Entrar no painel</button></form></article>`;
    return;
  }
  let body = '';
  if (tab === 'features') {
    config = await request('/settings');
    body = `<article class="card"><h2>Ferramentas disponíveis no site</h2><p>Desativar todas deixa o conteúdo e as ferramentas vazios, mantendo somente o cabeçalho. Os dados públicos permanecem guardados para reativação.</p><div class="form-actions"><button class="button" data-action="disable-all">Desabilitar todas</button><button class="button primary" data-action="enable-all">Habilitar todas</button></div>${Object.entries(
      FEATURES,
    )
      .map(
        ([key, label]) =>
          `<label class="tool-switch"><span>${h(label)}</span><input type="checkbox" role="switch" aria-label="${h(label)}" data-feature="${key}" ${config.features[key] ? 'checked' : ''}></label>`,
      )
      .join('')}</article>`;
  } else if (tab === 'automation') {
    const data = await request('/automation');
    body = `<div class="form-actions"><button class="button primary" data-action="sync">Verificar atualizações</button><button class="button" data-action="refresh">Atualizar estado</button></div>${notice('Sincronização automática de notícias e vagas a cada seis horas, sem IA. O botão respeita os limites de frequência das fontes. O radar usa lotes limitados da base pública para caber na hospedagem gratuita. Falhas preservam o último catálogo.')}<div class="grid">${data.sources.map((s) => `<article class="card"><h3>${h(s.name)}</h3>${external(s.terms, 'Condições de uso')}</article>`).join('')}</div><h2>Últimas execuções</h2><div class="stack">${data.jobs.map((j) => `<article class="card"><h3>${h(j.source)} · ${h(j.status)}</h3><p>${h(j.started_at)}</p><pre>${h(j.summary)}</pre></article>`).join('') || empty('Aguardando primeira atualização')}</div>`;
  } else {
    items = await request('/records/' + tab);
    if (editing !== null) body = editor(tab, items.find((r) => r.id === editing) || {});
    else
      body = `<div class="section-title"><h2>${h(tabs.find((t) => t[0] === tab)[1])}</h2>${tab === 'story' ? '<button class="button primary" data-action="new">Adicionar relato</button>' : ''}</div><div class="stack">${items.map((r) => `<article class="card"><div class="meta">${h(r.status)} · ${r.automatic ? 'Automático' : h(r.author || 'Anônimo / curadoria')}</div><h3>${h(r.title)}</h3><p>${h((r.body || '').slice(0, 300))}</p><div class="form-actions"><button class="button small" data-action="edit" data-id="${h(r.id)}">Editar</button>${r.status !== 'published' ? `<button class="button small primary" data-action="publish" data-id="${h(r.id)}">Revisar e publicar</button>` : `<button class="button small" data-action="archive" data-id="${h(r.id)}">Retirar do site</button>`}</div></article>`).join('') || empty('Nenhum registro nesta área')}</div>`;
  }
  main.innerHTML =
    `<div class="section-title"><p>${h(session.name)}</p><button class="button" data-action="logout">Sair</button></div><nav class="tabs">${tabs.map(([key, label]) => `<button class="chip ${tab === key ? 'active' : ''}" data-action="tab" data-tab="${key}">${label}</button>`).join('')}</nav>` +
    body;
  refreshIcons();
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const action = b.dataset.action;
  try {
    if (action === 'close-dialog') {
      document.querySelector('#dialog').close();
      return;
    }
    if (action === 'tab') {
      tab = b.dataset.tab;
      editing = null;
    } else if (action === 'logout') {
      await request('/auth/logout', {});
      session = null;
      csrf = null;
    } else if (action === 'new') editing = '';
    else if (action === 'edit') editing = b.dataset.id;
    else if (action === 'cancel') editing = null;
    else if (action === 'disable-all' || action === 'enable-all') {
      await request(
        '/settings',
        {
          features: Object.fromEntries(
            Object.keys(FEATURES).map((k) => [k, action === 'enable-all']),
          ),
        },
        'PUT',
      );
      toast('Ferramentas atualizadas.');
    } else if (action === 'sync') {
      await request('/automation/run', {});
      toast('Verificação solicitada. Atualize o estado em alguns instantes.');
    } else if (action === 'archive') {
      await request('/records/' + encodeURIComponent(b.dataset.id) + '/archive', {});
      toast('Publicação retirada do site.');
    } else if (action === 'publish') {
      const r = items.find((r) => r.id === b.dataset.id);
      dialog(
        'Revisar publicação',
        `<h3>${h(r.title)}</h3><p style="white-space:pre-wrap">${h(r.body)}</p><form data-form="publish" data-id="${h(r.id)}" class="stack">${check('attestation', 'Conferi o texto, a autorização e removi contatos/dados que não devem ser públicos.')}<button class="button primary">Publicar no site</button></form>`,
      );
      return;
    }
    await render();
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener('change', async (e) => {
  if (!e.target.dataset.feature) return;
  try {
    const features = { ...config.features, [e.target.dataset.feature]: e.target.checked };
    config = await request('/settings', { features }, 'PUT');
    toast('Ferramenta atualizada.');
  } catch (error) {
    e.target.checked = !e.target.checked;
    toast(error.message);
  }
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(form));
  try {
    if (form.dataset.form === 'login') {
      const data = await request('/auth/login', {
        password: v.password,
        ...(secondFactorRequired ? { code: v.code } : {}),
      });
      session = data.user;
      csrf = data.csrf;
    } else if (form.dataset.form === 'publish') {
      if (!v.attestation) throw new Error('Confirme a revisão antes de publicar.');
      await request('/records/' + encodeURIComponent(form.dataset.id) + '/publish', {
        attestation: true,
      });
      document.querySelector('#dialog').close();
    } else {
      const data =
        form.dataset.form === 'story'
          ? {
              title: v.title,
              body: v.body,
              author: v.anonymous ? '' : v.author,
              anonymous: !!v.anonymous,
              consent: !!v.consent,
              sourceName: 'Relato autorizado enviado por e-mail',
              sourceDate: new Date().toISOString().slice(0, 10),
            }
          : JSON.parse(v.json);
      await request(
        '/records/' + tab + (editing ? '/' + encodeURIComponent(editing) : ''),
        data,
        editing ? 'PUT' : 'POST',
      );
      editing = null;
      toast('Rascunho salvo. Revise para publicar.');
    }
    await render();
  } catch (error) {
    toast(error.message);
  }
});
request('/auth/session')
  .then((data) => {
    session = data.user;
    csrf = data.csrf;
    secondFactorRequired = data.secondFactorRequired;
    return render();
  })
  .catch((e) => {
    document.querySelector('#main').innerHTML = empty('Painel indisponível', e.message);
  });
