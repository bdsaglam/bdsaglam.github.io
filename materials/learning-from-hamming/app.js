(() => {
  const main = document.querySelector('main');
  const toolbar = document.querySelector('.toolbar');
  const data = window.hammingWalks;
  if (!data?.clusters.length) {
    document.getElementById('loading').textContent = 'The readings could not load. Reload to try again.';
    return;
  }

  const clusters = new Map(data.clusters.map(cluster => [cluster.id, cluster]));
  const readings = new Map(data.clusters.flatMap(cluster => cluster.readings.map(
    reading => [reading.id, { ...reading, cluster }]
  )));
  const readingIds = [...readings.keys()];
  const storageKey = 'learning-from-hamming-v1';
  const history = readHistory();

  function readHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Array.isArray(saved.seen)) return saved;
    } catch {
      // The page can still draw readings with storage disabled.
    }
    return { seen: [] };
  }

  function saveHistory() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch {
      // Draw history stays available until this tab closes.
    }
  }

  function dateKey() {
    const today = new Date();
    return [today.getFullYear(), today.getMonth() + 1, today.getDate()].join('-');
  }

  function choose(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function draw(exclude) {
    const seen = new Set(history.seen.filter(id => readings.has(id)));
    let options = readingIds.filter(id => !seen.has(id));
    if (!options.length) {
      seen.clear();
      options = readingIds;
    }
    const alternatives = options.filter(id => id !== exclude);
    const id = choose(alternatives.length ? alternatives : options);
    seen.add(id);
    history.seen = [...seen];
    saveHistory();
    return id;
  }

  function todayReading() {
    const date = dateKey();
    if (history.date !== date || !readings.has(history.today)) {
      history.today = draw(history.today);
      history.date = date;
      saveHistory();
    }
    return readings.get(history.today);
  }

  function mix(previous) {
    const first = choose([...clusters.values()]);
    const second = choose(data.clusters.filter(cluster => cluster !== first));
    const pairs = first.readings.flatMap(left => second.readings.map(right => [left.id, right.id]));
    const otherPairs = pairs.filter(pair => !pair.every(id => previous.includes(id)));
    return choose(otherPairs.length ? otherPairs : pairs);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const use = document.createElementNS(ns, 'use');
    svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', '#icon-' + name);
    svg.append(use);
    return svg;
  }

  function link(text, href, className) {
    const anchor = element('a', className, text);
    anchor.href = href;
    return anchor;
  }

  function sourceLink(text, href, symbol) {
    const anchor = link(text, href);
    anchor.prepend(icon(symbol));
    return anchor;
  }

  function sourceLinks(reading) {
    const row = element('p', 'sources');
    const { label, url } = reading.source;
    const chapter = /^Chapter (\d+)$/.exec(label);
    if (!chapter) {
      row.append(sourceLink(label, url, 'play'));
      return row;
    }
    row.append(sourceLink('Read ' + label.toLowerCase(), url, 'book'));
    const lecture = reading.lecture ?? data.chapterLectures[chapter[1]];
    if (lecture) {
      row.append(sourceLink(lecture.label, lecture.url, 'play'));
    }
    return row;
  }

  function questions(reading, level) {
    const section = element('div', 'questions');
    const list = element('ul');
    reading.questions.forEach(question => list.append(element('li', '', question)));
    section.append(element('h' + level, '', 'On your walk'), list);
    return section;
  }

  function relatedNotes(reading, level) {
    const section = element('section', 'related');
    const title = element('h' + level, '', 'Related notes');
    title.id = 'related-' + reading.id;
    section.setAttribute('aria-labelledby', title.id);
    section.append(title);
    reading.related.forEach(id => {
      const note = readings.get(id);
      const disclosure = element('details');
      const summary = element('summary', '', note.title);
      summary.append(icon('down'));
      const content = element('div', 'related-content');
      content.append(element('p', 'reading-text', note.text), questions(note, level + 1), sourceLinks(note));
      disclosure.append(summary, content);
      section.append(disclosure);
    });
    return section;
  }

  function card(reading, { level = 2, showCluster = true, showRelated = false } = {}) {
    const article = element('article', 'reading');
    article.dataset.reading = reading.id;
    const title = element('h' + level, 'reading-title', reading.title);
    title.id = 'note-' + reading.id;
    article.setAttribute('aria-labelledby', title.id);
    if (showCluster) {
      article.append(link(reading.cluster.title, '#cluster/' + reading.cluster.id, 'cluster-link'));
    }
    article.append(title, element('p', 'reading-text', reading.text), questions(reading, level + 1), sourceLinks(reading));
    if (showRelated) article.append(relatedNotes(reading, level + 1));
    return article;
  }

  function heading(text) {
    return element('h2', 'view-heading', text);
  }

  function clusterIndex() {
    const list = element('ul', 'cluster-list');
    data.clusters.forEach(cluster => {
      const item = element('li');
      const anchor = link(cluster.title, '#cluster/' + cluster.id);
      anchor.append(element('small', '', cluster.readings.length + ' notes'));
      item.append(anchor);
      list.append(item);
    });
    return [heading('Browse clusters'), list];
  }

  function wholeCluster(cluster) {
    return [
      link('All clusters', '#browse', 'cluster-back'),
      heading(cluster.title),
      ...cluster.readings.map(note => card(readings.get(note.id), { level: 3, showCluster: false })),
    ];
  }

  function combination(ids) {
    const prompt = element('div', 'questions mix-prompt');
    prompt.append(
      element('h3', '', 'Think across the two'),
      element('p', '', 'Bring both ideas to a decision on your mind. Where do they point the same way? Where would following one change how you use the other?')
    );
    return [heading('Two clusters'), ...ids.map(id => card(readings.get(id), { level: 3 })), prompt];
  }

  function route() {
    const [mode, first, second] = location.hash.slice(1).split('/');
    if (mode === 'browse') return { mode };
    if (mode === 'cluster' && clusters.has(first)) return { mode, first };
    if (mode === 'reading' && readings.has(first)) return { mode, first };
    if (mode === 'mix' && readings.has(first) && readings.has(second)
        && readings.get(first).cluster !== readings.get(second).cluster) return { mode, first, second };
    return { mode: 'today' };
  }

  function render(focus = false) {
    const { mode, first, second } = route();
    let active = mode;
    let content;
    if (mode === 'browse') {
      content = clusterIndex();
    } else if (mode === 'cluster') {
      active = 'browse';
      content = wholeCluster(clusters.get(first));
    } else if (mode === 'mix') {
      content = combination([first, second]);
    } else {
      active = mode === 'reading' ? 'draw' : 'today';
      const reading = mode === 'reading' ? readings.get(first) : todayReading();
      content = [card(reading, { showRelated: true })];
    }
    toolbar.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.action === active));
      if (button.dataset.action === 'mix') {
        button.querySelector('span').textContent = mode === 'mix' ? 'Mix again' : 'Mix clusters';
      }
    });
    main.replaceChildren(...content);
    if (focus) {
      const title = main.querySelector('h2');
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
      if (toolbar.getBoundingClientRect().top < 0) {
        toolbar.scrollIntoView({ block: 'start' });
      }
    }
  }

  function navigate(hash) {
    const url = location.pathname + location.search + hash;
    if (hash !== location.hash) window.history.pushState(null, '', url);
    render(true);
  }

  toolbar.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const current = route();
    switch (button.dataset.action) {
      case 'today':
        navigate('');
        break;
      case 'draw':
        navigate('#reading/' + draw(current.mode === 'reading' ? current.first : todayReading().id));
        break;
      case 'mix':
        navigate('#mix/' + mix([current.first, current.second]).join('/'));
        break;
      case 'browse':
        navigate('#browse');
        break;
    }
  });

  window.addEventListener('hashchange', () => {
    if (location.hash !== '#reading-content') render(true);
  });
  render();
})();
