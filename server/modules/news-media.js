import { mkdir, writeFile, readdir, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
export const mediaDirectory = () => resolve(process.env.MEDIA_PATH || 'data/media');
const plain = (s) =>
  String(s || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
export function ebcExcerpt(item) {
  const creator = plain(item['dc:creator']);
  if (
    !/ag[eê]ncia brasil|\bebc\b/i.test(creator) ||
    /reuters|\bafp\b|associated press|direitos reservados/i.test(item.description || '')
  )
    return {};
  const first = String(item.description || '')
    .split(/<\/p\s*>/i)
    .map(plain)
    .find((p) => p.length > 60 && !/^not[ií]cias relacionadas/i.test(p));
  if (!first) return {};
  return {
    excerpt: first.length > 1500 ? first.slice(0, 1499) + '…' : first,
    excerptCredit: creator.slice(0, 240),
  };
}
export function ebcPhoto(html) {
  // Only the main photo's caption is used; a credit on a related story is not evidence.
  const credit = plain(
    html.match(
      /<figcaption\b[^>]*class=["'][^"']*credito-foto[^"']*["'][^>]*>([\s\S]*?)<\/figcaption>/i,
    )?.[1],
  );
  if (
    !/\/\s*(?:Ag[eê]ncia Brasil|EBC)\s*$/i.test(credit) ||
    /reservad|reuters|afp|divulga/i.test(credit)
  )
    return null;
  const raw = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
  try {
    const u = new URL(raw?.replaceAll('&amp;', '&'));
    if (
      u.protocol !== 'https:' ||
      !['imagens.ebc.com.br', 'agenciabrasil.ebc.com.br'].includes(u.hostname) ||
      u.username ||
      u.password
    )
      return null;
    return { url: u.href, credit: credit.slice(0, 240) };
  } catch {
    return null;
  }
}
export async function enrichEbc(item, { fetcher = fetch, fetchText }) {
  const u = new URL(item.data.sourceUrl);
  if (u.hostname !== 'agenciabrasil.ebc.com.br' || !u.pathname.startsWith('/educacao/noticia/'))
    return;
  const html = await fetchText(u.href, { fetcher, maxBytes: 512 * 1024, timeout: 10000 });
  const photo = ebcPhoto(html);
  if (!photo) return;
  const response = await fetcher(photo.url, {
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  });
  if (
    !response.ok ||
    !/^image\/jpeg\b/i.test(response.headers.get('content-type') || '') ||
    Number(response.headers.get('content-length')) > 1500000
  ) {
    await response.body?.cancel();
    return;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 1500000) throw new Error('Foto excedeu limite.');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return;
  const file = createHash('sha1').update(bytes).digest('hex') + '.jpg';
  await mkdir(mediaDirectory(), { recursive: true });
  await writeFile(resolve(mediaDirectory(), file), bytes);
  item.data.image = file;
  item.data.imageCredit = photo.credit;
}
export async function pruneMedia(db) {
  const dir = mediaDirectory();
  await mkdir(dir, { recursive: true });
  const files = (await readdir(dir)).filter((x) => /^[a-f0-9]{40}\.jpg$/.test(x));
  const ordered = await Promise.all(
    files.map(async (name) => ({ name, mtime: (await stat(resolve(dir, name))).mtimeMs })),
  );
  ordered.sort((a, b) => b.mtime - a.mtime);
  for (const file of ordered.slice(60)) {
    // Only generated image cache files in the designated media directory.
    db.prepare(
      "UPDATE records SET data=json_set(data,'$.image','','$.imageCredit','') WHERE json_extract(data,'$.image')=?",
    ).run(file.name);
    await unlink(resolve(dir, file.name));
  }
}
