import { distanceKm } from '../../shared/filter.js';
export function nearestCity(rows, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw new Error('Coordenadas inválidas.');
  let closest,
    distance = Infinity;
  for (const [city, state, a, b] of rows) {
    const km = distanceKm(lat, lng, a, b);
    if (km < distance) {
      distance = km;
      closest = { city, state, distance: km };
    }
  }
  return distance <= 100 ? closest : null;
}
export async function locateForm(form, coords) {
  const r = await fetch(`${import.meta.env?.BASE_URL || '/'}data/municipios.json`, {
    credentials: 'omit',
  });
  if (!r.ok)
    throw new Error('Não foi possível consultar os municípios. Escolha a cidade manualmente.');
  const city = nearestCity(await r.json(), coords.latitude, coords.longitude);
  if (!city)
    throw new Error('Nenhum município brasileiro próximo foi reconhecido. Escolha manualmente.');
  if (form.elements.country) form.elements.country.value = 'BR';
  if (form.elements.state) form.elements.state.value = city.state;
  if (form.elements.city) form.elements.city.value = city.city;
  if (form.elements.lat) form.elements.lat.value = coords.latitude.toFixed(4);
  if (form.elements.lng) form.elements.lng.value = coords.longitude.toFixed(4);
  return city;
}
