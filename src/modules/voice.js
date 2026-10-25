import { state, loadRecords, api, enabled } from '../api.js';
import { viewControls, h, heading, card, notice, external, dialog, empty } from '../ui.js';
export function formLinks() {
  return `<a class="button primary" href="${import.meta.env.BASE_URL}formularios/voz-do-professor.pdf" download>Baixar PDF preenchível</a>`;
}
export async function voice() {
  const stories = await loadRecords('story');
  const surveys = await loadRecords('survey');
  return (
    heading(
      'Sua experiência importa',
      'Voz do Professor',
      'Você escreve no PDF, salva no seu aparelho e envia pelo seu próprio e-mail. Nada é enviado por este site.',
    ) +
    `<article class="card"><h2>Relato, sugestão ou remoção</h2><p>Baixe o formulário, escolha o tipo de pedido e preencha fora do site. Nome opcional; você pode pedir publicação anônima. Para remover ou corrigir um relato, indique o link ou código da publicação.</p><p>Destinatário: <strong>${h(state.config.contactEmail)}</strong></p>${state.config.contactEmail.endsWith('.invalid') ? notice('E-mail demonstrativo: ainda não recebe mensagens. Aguarde o endereço real antes de enviar.') : ''}<div class="form-actions">${formLinks()}</div><p class="small-text muted">Não há upload nem formulário de texto online. O remetente do e-mail é visível ao administrador e ao provedor de e-mail, mesmo se a publicação for anônima.</p></article>` +
    `<div class="section-title"><h2>Relatos publicados</h2></div>${viewControls(state)}<div class="masonry">${stories.map((r) => card(r, state)).join('') || empty('Nenhum relato publicado', 'Somente relatos autorizados e adicionados pelo responsável aparecem aqui.')}</div>` +
    (enabled('survey')
      ? `<div class="section-title"><h2>Temas de escuta</h2></div>${viewControls(state)}<div class="masonry">${surveys.map((r) => card(r, state)).join('')}</div>`
      : '')
  );
}
export async function survey(id) {
  const r = await api(`/record/${encodeURIComponent(id)}`);
  return (
    heading('Participação fora do site', r.title, r.purpose) +
    `<article class="card">${r.questions.map((q) => `<h3>${h(q.label)}</h3><p>${q.options.map(h).join(' · ')}</p>`).join('')}<p>Anote suas respostas no campo de mensagem do PDF e indique o título desta pesquisa. Não coletamos respostas online.</p><div class="form-actions">${formLinks()}</div></article>`
  );
}
export function story() {
  dialog(
    'Envio por e-mail',
    `<p>Preencha e salve o PDF no seu aparelho. Envie o anexo pelo seu e-mail para ${h(state.config.contactEmail)}. O site não recebe o documento.</p>${formLinks()}`,
  );
}
export const withdrawal = story;
