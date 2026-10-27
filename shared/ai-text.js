// A small presentation-only Markdown subset. Raw HTML is never interpreted.
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function inline(text) {
  return text
    .split(/(\[[^\]\n]+\]\(https:\/\/[^\s)]+\)|\*\*[^*\n]+\*\*)/g)
    .map((part) => {
      const link = part.match(/^\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)$/);
      if (link) {
        try {
          const url = new URL(link[2]);
          if (url.protocol === 'https:' && !url.username && !url.password)
            return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${escape(link[1])}</a>`;
        } catch {}
      }
      if (/^\*\*[^*\n]+\*\*$/.test(part)) return `<strong>${escape(part.slice(2, -2))}</strong>`;
      return escape(part);
    })
    .join('');
}
export function formatAiText(text) {
  let list = false,
    output = '';
  for (const line of String(text).split('\n')) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (!list) output += '<ul>';
      list = true;
      output += `<li>${inline(bullet[1])}</li>`;
      continue;
    }
    if (list) {
      output += '</ul>';
      list = false;
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) output += `<h3>${inline(heading[1])}</h3>`;
    else if (line.trim()) output += `<p>${inline(line)}</p>`;
  }
  return output + (list ? '</ul>' : '');
}
