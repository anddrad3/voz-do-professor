import { dialog, toast } from '../ui.js';
import { avatar, validAvatar } from './personalization.js';
export function photoField(value = '') {
  return `<div class="photo-field"><div data-photo-preview>${avatar(value)}</div><input type="hidden" name="avatarData" value=""><button type="button" class="button" data-photo-editor>Escolher e ajustar foto</button><p class="muted small-text">Arraste uma imagem ou selecione um arquivo. Ajuste o recorte antes de salvar.</p></div>`;
}
export function editedPhoto(form) {
  const value = form.elements.avatarData?.value || '';
  if (value && !validAvatar(value))
    throw new Error('Foto inválida. Abra o editor e tente novamente.');
  return value;
}
export function installPhotoEditor() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-photo-editor]');
    if (!trigger) return;
    const form = trigger.closest('form');
    dialog(
      'Ajustar foto do perfil',
      `<div class="photo-editor"><label class="photo-drop">Arraste uma foto aqui ou selecione um arquivo<input type="file" name="cropFile" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG ou WebP · até 5 MB. A edição acontece neste dispositivo.</small></label><canvas width="256" height="256" aria-label="Prévia do recorte da foto"></canvas><p class="muted small-text">Arraste a foto para posicionar ou use os controles abaixo.</p><div class="photo-sliders"><label>Ampliação<input type="range" name="zoom" min="1" max="3" step=".01" value="1" disabled></label><label>Posição horizontal<input type="range" name="cropX" min="0" max="100" value="50" disabled></label><label>Posição vertical<input type="range" name="cropY" min="0" max="100" value="50" disabled></label></div><p class="photo-status" role="status">Selecione uma imagem para começar.</p><div class="form-actions"><button type="button" class="button" data-photo-reset disabled>Centralizar</button><button type="button" class="button primary" data-photo-apply disabled>Usar esta foto</button><button type="button" class="button" data-action="close-dialog">Cancelar</button></div></div>`,
    );
    const modal = document.querySelector('#dialog'),
      editor = modal.querySelector('.photo-editor');
    const canvas = editor.querySelector('canvas'),
      context = canvas.getContext('2d');
    const zoom = editor.querySelector('[name="zoom"]'),
      x = editor.querySelector('[name="cropX"]'),
      y = editor.querySelector('[name="cropY"]');
    const status = editor.querySelector('.photo-status'),
      drop = editor.querySelector('.photo-drop');
    let bitmap = null,
      sequence = 0,
      pointer = null;
    const draw = () => {
      if (!bitmap) return;
      const size = Math.min(bitmap.width, bitmap.height) / Number(zoom.value);
      context.fillStyle = '#fff';
      context.fillRect(0, 0, 256, 256);
      context.drawImage(
        bitmap,
        ((bitmap.width - size) * Number(x.value)) / 100,
        ((bitmap.height - size) * Number(y.value)) / 100,
        size,
        size,
        0,
        0,
        256,
        256,
      );
    };
    const load = async (file) => {
      const current = ++sequence;
      try {
        if (
          !file ||
          file.size > 5 * 1024 * 1024 ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
        )
          throw new Error('Selecione JPG, PNG ou WebP de até 5 MB.');
        const next = await createImageBitmap(file);
        if (current !== sequence || !modal.open) {
          next.close();
          return;
        }
        if (next.width * next.height > 40000000) {
          next.close();
          throw new Error('Imagem muito grande. Use uma foto de até 40 megapixels.');
        }
        bitmap?.close();
        bitmap = next;
        zoom.value = '1';
        x.value = y.value = '50';
        editor.querySelectorAll('[disabled]').forEach((el) => (el.disabled = false));
        status.textContent = 'Ajuste o enquadramento. O arquivo original não será enviado.';
        draw();
      } catch (error) {
        status.textContent = error.message;
      }
    };
    editor
      .querySelector('[type="file"]')
      .addEventListener('change', (event) => load(event.target.files[0]));
    drop.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.classList.add('dragging');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('dragging');
      void load(event.dataTransfer.files[0]);
    });
    [zoom, x, y].forEach((el) => el.addEventListener('input', draw));
    canvas.addEventListener('pointerdown', (event) => {
      if (!bitmap) return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        cropX: Number(x.value),
        cropY: Number(y.value),
      };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const size = Math.min(bitmap.width, bitmap.height) / Number(zoom.value),
        width = canvas.getBoundingClientRect().width;
      const shift = (delta, available) =>
        available > 0 ? ((delta * size) / width / available) * 100 : 0;
      x.value = String(
        Math.max(
          0,
          Math.min(100, pointer.cropX - shift(event.clientX - pointer.x, bitmap.width - size)),
        ),
      );
      y.value = String(
        Math.max(
          0,
          Math.min(100, pointer.cropY - shift(event.clientY - pointer.y, bitmap.height - size)),
        ),
      );
      draw();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      canvas.addEventListener(name, () => (pointer = null));
    editor.querySelector('[data-photo-reset]').addEventListener('click', () => {
      zoom.value = '1';
      x.value = y.value = '50';
      draw();
    });
    editor.querySelector('[data-photo-apply]').addEventListener('click', () => {
      if (!bitmap) return;
      const output = document.createElement('canvas');
      output.width = output.height = 192;
      output.getContext('2d').drawImage(canvas, 0, 0, 192, 192);
      const value = output.toDataURL('image/jpeg', 0.8);
      if (!validAvatar(value)) {
        status.textContent = 'Não foi possível reduzir a imagem. Escolha outra foto.';
        return;
      }
      form.elements.avatarData.value = value;
      form.querySelector('[data-photo-preview]').innerHTML = avatar(value);
      if (form.elements.removeAvatar) form.elements.removeAvatar.checked = false;
      modal.close();
      toast('Foto preparada. Salve o perfil para concluir.');
    });
    modal.addEventListener(
      'close',
      () => {
        sequence++;
        bitmap?.close();
        bitmap = null;
      },
      { once: true },
    );
  });
}
