// Timestamped notes: pure functions the board uses to read and change a media view's notes file.
// No DOM; node loads this file for the tests.
//
// A notes file is Markdown the user, the board, and the agent all write, e.g.
//
//   # Lecture 13 - Information Theory · notes
//   - [05:51](https://www.youtube.com/watch?v=YF2wOE66gfw&t=351s) text
//   - [1:02:03] a note without a link
//     - a sub-bullet, which belongs to the note above
//
// A note is a top-level bullet whose first word is a time in brackets ("m:ss", "mm:ss", or
// "h:mm:ss"), with or without a link. The board never rewrites a line it did not create: insert()
// adds one line among the notes in time order (a note's indented lines stay with it) and keeps
// every other byte, and remove() deletes one exact line. Both take the file as it is on disk now.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FluidNotes = api;
})(typeof self !== 'undefined' ? self : this, () => {
  const pad = (n) => String(n).padStart(2, '0');

  // 351 -> "05:51", 3723 -> "1:02:03".
  function fmt(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
  }

  // "ss", "m:ss", or "h:mm:ss" -> seconds; anything else -> null.
  function parseTime(str) {
    const text = String(str ?? '').trim();
    if (!/^\d+(:\d{1,2}){0,2}$/.test(text)) return null;
    const n = text.split(':').map(Number);
    if (n.length > 1 && n.slice(1).some((x) => x >= 60)) return null;
    return n.reduce((s, x) => s * 60 + x, 0);
  }

  // The link to a moment: a YouTube URL gets t=<N>s, any other URL a media fragment #t=<N>.
  function link(base, sec) {
    if (!base) return '';
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const url = String(base).split('#')[0];
    if (/^https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) {
      const plain = url.replace(/([?&])t=\d+s?(&|$)/, (_, a, b) => (b ? a : '')).replace(/[?&]$/, '');
      return `${plain}${plain.includes('?') ? '&' : '?'}t=${s}s`;
    }
    return `${url}#t=${s}`;
  }

  // One line of text: newlines and runs of space become one space.
  const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

  // The line insert() writes for a note {sec, text, link?}.
  function bullet(note) {
    const label = fmt(note.sec), url = note.link || '';
    return `- [${label}]${url ? `(${url})` : ''} ${clean(note.text)}`.trimEnd();
  }

  const NOTE = /^[-*+][ \t]+\[([^\]\n]*)\](?:\(([^)\s]*)\))?(?:[ \t]+(.*))?$/;
  const lines = (text) => String(text ?? '').split('\n');  // in a CRLF file each line keeps its \r
  const bare = (line) => line.replace(/\r$/, '');

  // The notes in a file, in file order: {line, sec, label, url, text, raw, children}. `line` is the
  // 0-based line, `raw` the line without its line ending, `children` how many indented lines follow
  // it (blank lines between them included).
  function parse(text) {
    const ls = lines(text), out = [];
    for (let i = 0; i < ls.length; i++) {
      const raw = bare(ls[i]), m = raw.match(NOTE);
      if (!m) continue;
      let sec = parseTime(m[1]);
      if (sec == null) {
        const t = (m[2] || '').match(/[?&#]t=(\d+)/);
        if (!t) continue;
        sec = Number(t[1]);
      }
      let last = i;
      for (let j = i + 1; j < ls.length; j++) {
        const l = bare(ls[j]);
        if (!l.trim()) continue;
        if (/^[ \t]/.test(l)) last = j;
        else break;
      }
      out.push({ line: i, sec, label: m[1], url: m[2] || '', text: (m[3] || '').trim(), raw, children: last - i });
    }
    return out;
  }

  // The file with the note {sec, text, link?} added: before the first note that comes later in
  // time, else after the last note and its indented lines, else at the end. An empty or missing
  // file starts with `header`. Every other line is kept as it was, and so is the line ending.
  function insert(text, note, header = '') {
    const src = String(text ?? '');
    const eol = src.includes('\r\n') ? '\r\n' : '\n';
    const line = bullet(note);
    if (!src.trim()) return (header ? header + eol : '') + line + eol;
    const ls = lines(src), cr = eol === '\r\n' ? '\r' : '';
    const notes = parse(src);
    const next = notes.find((n) => n.sec > note.sec);
    let at;
    if (next) at = next.line;
    else if (notes.length) { const last = notes[notes.length - 1]; at = last.line + last.children + 1; }
    else at = ls[ls.length - 1] === '' ? ls.length - 1 : ls.length;
    if (at >= ls.length) {  // after a last line that has no line ending: give it one
      ls[ls.length - 1] += eol === '\r\n' && !ls[ls.length - 1].endsWith('\r') ? '\r' : '';
      ls.push(line);
    } else ls.splice(at, 0, line + cr);
    return ls.join('\n');
  }

  // The file without the line `raw` (as parse() gave it): the copy nearest line `near`, when the
  // file holds it more than once. {text, removed}; removed is false when the line is gone.
  function remove(text, raw, near = 0) {
    const src = String(text ?? ''), ls = lines(src);
    let best = -1;
    ls.forEach((l, i) => { if (bare(l) === raw && (best < 0 || Math.abs(i - near) < Math.abs(best - near))) best = i; });
    if (best < 0) return { text: src, removed: false };
    const lastLine = best === ls.length - 1;  // no line ending after it
    ls.splice(best, 1);
    if (lastLine && best > 0) ls[best - 1] = bare(ls[best - 1]);
    return { text: ls.join('\n'), removed: true };
  }

  return { fmt, parseTime, link, clean, bullet, parse, insert, remove };
});
