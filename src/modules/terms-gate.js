import { TERMS, TERMS_VERSION } from '../../shared/terms.js';
import { h } from '../ui.js';
const KEY = 'voz-terms-accepted';
export function installTermsGate() {
  let accepted = false;
  try {
    accepted = localStorage.getItem(KEY) === TERMS_VERSION;
  } catch {}
  const gate = document.createElement('dialog');
  gate.className = 'terms-gate';
  gate.setAttribute('aria-labelledby', 'terms-gate-title');
  gate.setAttribute('aria-describedby', 'terms-gate-description');
  gate.innerHTML = `<div class="terms-gate-content"><div><span class="eyebrow">Antes de continuar</span><h2 id="terms-gate-title">Termos e Condições</h2><p id="terms-gate-description">Leia as condições de uso. O aceite fica somente neste navegador; limpar os dados locais faz este aviso aparecer novamente. Não há cadastro de visitante.</p><details><summary>Ler os termos completos · ${h(TERMS_VERSION)}</summary><div class="terms-preview">${TERMS.map(([title, body]) => `<h3>${h(title)}</h3><p>${h(body)}</p>`).join('')}</div></details></div><button class="button primary" type="button" data-accept-terms>Aceito os termos e condições</button></div>`;
  document.body.append(gate);
  gate.addEventListener('cancel', (event) => event.preventDefault());
  gate.querySelector('[data-accept-terms]').addEventListener('click', () => {
    accepted = true;
    try {
      localStorage.setItem(KEY, TERMS_VERSION);
    } catch {}
    gate.close();
  });
  const intercept = (event) => {
    if (accepted || gate.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!gate.open) gate.showModal();
  };
  document.addEventListener('click', intercept, true);
  document.addEventListener('submit', intercept, true);
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) accepted = event.newValue === TERMS_VERSION;
  });
  window.addEventListener('voz-local-cleared', () => {
    accepted = false;
  });
}
