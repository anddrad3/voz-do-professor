import { state, enabled } from '../api.js';
import { h } from '../ui.js';
export const validAvatar = (value) =>
  typeof value === 'string' &&
  value.length <= 90000 &&
  /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);
export function avatar(value, label = 'Foto do perfil') {
  return validAvatar(value)
    ? `<img class="profile-avatar" src="${h(value)}" alt="${h(label)}" width="72" height="72">`
    : '';
}
export function greeting(context = '') {
  if (!enabled('preferences') || !state.profile.name) return '';
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return `<div class="personal-greeting">${avatar(state.profile.avatar)}<div><strong>${hello}, ${h(String(state.profile.name).slice(0, 60))}.</strong>${context ? `<p>${h(context)}</p>` : ''}</div></div>`;
}
// Decode and redraw locally: only a small JPEG without original metadata is retained.
export async function readAvatar(file) {
  if (!file?.size) return null;
  if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 192, 192);
    const size = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(
      bitmap,
      (bitmap.width - size) / 2,
      (bitmap.height - size) / 2,
      size,
      size,
      0,
      0,
      192,
      192,
    );
    const data = canvas.toDataURL('image/jpeg', 0.8);
    if (!validAvatar(data))
      throw new Error('Não foi possível reduzir a imagem. Escolha outra foto.');
    return data;
  } finally {
    bitmap.close();
  }
}
