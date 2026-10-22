/* app.js: the Antrenman PWA. Tabs (Bugün, Program, Geçmiş, Kurallar) and the full-screen workout mode,
 * ported from the Fluid canvas view "Antrenman modu" (.fluid/views/workout).
 *
 * Storage (localStorage):
 *   fit-log           JSON array of set records, the same shape as antrenman-log.jsonl:
 *                     {date, session, block, exercise, set, kg, reps, form, perSide?}
 *   fluid-workout-v1  the in-progress workout (step, sets, timers), same key as the Fluid view, plus `open`
 *   fit-block, fit-start   the program block / start date (read and written by exercise-data.js)
 *   fit-mobility      daily routines done: {"YYYY-MM-DD": {"sabah": ms, "aksam": ms}}; kept out of fit-log so
 *                     the lift history and "Son değerler" stay lift-only
 *
 * The daily routines (FIT_SESSION_META[k].routine: sabah, aksam) run through the same workout mode: one-item
 * list steps, a hold timer per side, and auto-advance with a short "Hazırlan" pause between moves.
 *
 * Language (js/i18n.js): UI strings come from T(key); exercises, steps and session meta go through FIT_tx (X, steps(),
 * M()) so they show in the active language; dates and decimals follow its locale. A switch (FIT_I18N.on) re-renders
 * the open screen in place; the workout state (ROOT) is untouched, so the step and the timers carry on.
 */
(function () {
  'use strict';
  var SESS = window.FIT_SESSIONS || {}, EX = window.FIT_EXERCISES || {}, META = window.FIT_SESSION_META || {};
  var I18N = window.FIT_I18N, TX = window.FIT_tx, T = I18N.t;
  var X = function (slug) { return TX.ex(slug) || {}; };          // exercise entry in the active language
  var M = function (k) { return TX.meta(k) || {}; };              // session meta (label, title, note) in the active language
  var KEY = 'fluid-workout-v1', LOGKEY = 'fit-log';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  var mmss = function (s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + pad(s % 60); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var today = function () { return iso(new Date()); };
  var parseDay = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  var dayTxt = function (s, withDow) { return parseDay(s) ? I18N.day(s, { dow: !!withDow }) : s; };
  var sesName = function (k) { return /^(sali|cuma|sabah|aksam)$/.test(k || '') ? T('ses.' + k) : ''; };
  var GYM = ['sali', 'cuma'];
  var ROUT = Object.keys(SESS).filter(function (k) { return META[k] && META[k].routine; });
  var isRoutine = function (k) { k = k || (ROOT && ROOT.session); return !!(META[k] && META[k].routine); };
  var PREP = window.FIT_ROUTINE_PREP || 5, SIDE_PREP = 4; // seconds to get into position before a move / a side
  var num = function (v) { if (v === '' || v == null) return null; var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  var fmt = function (n) { return n == null ? '' : I18N.num(Math.round(n * 100) / 100); };
  var shown = function (v) { var n = num(v); return v === '' || v == null ? '' : n == null ? String(v) : fmt(n); }; // a stored kg/reps value in the active locale

  /* ---------- log (localStorage 'fit-log') ---------- */
  function readLog() { try { var a = JSON.parse(localStorage.getItem(LOGKEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writeLog(a) { try { localStorage.setItem(LOGKEY, JSON.stringify(a)); return true; } catch (e) { return false; } }
  var hist = {}; // slug -> {date, sets: [record]}: the last day before today (or today if that is all)
  function buildHistory() {
    var by = {}, out = {}, t = today();
    readLog().forEach(function (r) { if (r && r.exercise && r.date) (by[r.exercise] = by[r.exercise] || []).push(r); });
    Object.keys(by).forEach(function (slug) {
      var recs = by[slug], dates = recs.map(function (r) { return r.date; }).sort();
      var past = dates.filter(function (d) { return d !== t; });
      var d = past.length ? past[past.length - 1] : dates[dates.length - 1];
      out[slug] = { date: d, sets: recs.filter(function (r) { return r.date === d; }).sort(function (a, b) { return a.set - b.set; }) };
    });
    hist = out;
  }

  /* ---------- daily routines done (localStorage 'fit-mobility') ---------- */
  var MOBKEY = 'fit-mobility';
  function readMob() { try { var o = JSON.parse(localStorage.getItem(MOBKEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function markMob(k) { var m = readMob(), d = today(); (m[d] = m[d] || {})[k] = Date.now(); try { localStorage.setItem(MOBKEY, JSON.stringify(m)); } catch (e) {} }
  function mobToday() { return readMob()[today()] || {}; }
  // this week (Monday to Sunday): "Bu hafta: sabah 4/7, akşam 3/7"
  function mobWeek() {
    var m = readMob(), d = new Date(), out = {}; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    ROUT.forEach(function (k) { out[k] = 0; });
    for (var i = 0; i < 7; i++) { var r = m[iso(d)] || {}; ROUT.forEach(function (k) { if (r[k]) out[k]++; }); d.setDate(d.getDate() + 1); }
    return out;
  }
  function mobWeekTxt() { var w = mobWeek(); return T('mob.week') + ROUT.map(function (k) { return I18N.lower(M(k).label || k) + ' ' + w[k] + '/7'; }).join(', '); }

  /* ---------- workout state (same shape as the Fluid view) ---------- */
  var ROOT;
  function load() {
    try { ROOT = JSON.parse(localStorage.getItem(KEY)); } catch (e) { ROOT = null; }
    if (!ROOT || ROOT.date !== today()) ROOT = { date: today(), session: null, last: ROOT && ROOT.last || null, open: false, s: {} };
    if (!ROOT.session || !SESS[ROOT.session]) ROOT.session = 'sali';
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ROOT)); } catch (e) {} }
  function S(k) {
    k = k || ROOT.session;
    if (!ROOT.s[k]) ROOT.s[k] = { step: 0, t0: 0, t1: 0, ex: {}, list: {}, cardio: {}, hold: null, rest: null, saved: 0 };
    return ROOT.s[k];
  }
  function block() { return window.FIT_currentBlock ? FIT_currentBlock() : 1; }
  function steps(k) { k = k || ROOT.session; return TX.steps(k); }
  function cur() { return steps()[S().step]; }
  function exState(st) {
    var s = S();
    if (!s.ex[st.id]) {
      var w = [], n = st.sets || 1, i;
      for (i = 0; i < n; i++) w.push({ done: 0, kg: '', reps: '' });
      var wu = []; for (i = 0; i < (st.warmupSets || 0); i++) wu.push(0);
      s.ex[st.id] = { warm: wu, work: w, form: true };
    }
    var ex = s.ex[st.id];
    if (st.perSide) ex.work.forEach(function (x) { if (!x.sides) x.sides = [x.done, x.done]; });
    return ex;
  }
  function touch() { var s = S(); if (!s.t0) s.t0 = Date.now(); }
  function inProgress(k) { var s = ROOT.s[k]; return !!(s && s.t0 && !s.t1); }

  // completed sets of one session as log records
  function records(k) {
    k = k || ROOT.session;
    var out = [], s = ROOT.s[k]; if (!s) return out;
    steps(k).forEach(function (st) {
      if (st.type !== 'exercise') return;
      var e = s.ex[st.id]; if (!e) return;
      e.work.forEach(function (w, i) {
        if (!w.done) return;
        var r = { date: ROOT.date, session: k, block: st.block || block(), exercise: st.slug, set: i + 1,
          kg: num(w.kg), reps: num(w.reps), form: e.form !== false };
        if (st.perSide) r.perSide = true;
        out.push(r);
      });
    });
    return out;
  }
  // write this session's sets into the log, replacing the same date + session (as the Fluid view does)
  function saveLog() {
    var k = ROOT.session, recs = records(k);
    var keep = readLog().filter(function (r) { return !(r.date === ROOT.date && r.session === k); });
    if (writeLog(keep.concat(recs))) { S().saved = Date.now(); save(); }
  }

  /* ---------- sound, vibration, wake lock ---------- */
  var AC = null;
  function unlock() {
    try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {}
    try { if (window.speechSynthesis && soundOn) speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}
  }
  // sound: short Web Audio tones per event, plus spoken move names (speechSynthesis, a voice of the active language when present)
  var soundOn = localStorage.getItem('fit-sound') !== '0';
  function tone(f, t0, dur, vol) {
    var o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + t0;
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  var CUES = {
    tick: [[660, 0, 0.09, 0.25]],                                                     // last seconds of a countdown
    go: [[1046, 0, 0.3]],                                                             // hold starts
    side: [[784, 0, 0.18], [1046, 0.2, 0.3]],                                         // switch sides
    done: [[1046, 0, 0.18], [784, 0.2, 0.3]],                                         // hold or rest over
    finish: [[523, 0, 0.16], [659, 0.17, 0.16], [784, 0.34, 0.16], [1046, 0.51, 0.45]] // routine or session done
  };
  var VIB = { tick: 40, go: 200, side: [150, 80, 150], done: [200, 100, 200], finish: [200, 100, 200, 100, 400] };
  function cue(name) {
    try { if (navigator.vibrate) navigator.vibrate(VIB[name]); } catch (e) {}
    if (!soundOn || !AC) return;
    try { CUES[name].forEach(function (c) { tone(c[0], c[1], c[2], c[3]); }); } catch (e) {}
  }
  function beep(n) { cue(n === 1 ? 'go' : n === 3 ? 'finish' : 'done'); }
  var voice = null;
  function pickVoice() {
    try {
      var vs = speechSynthesis.getVoices(), en = I18N.lang === 'en';
      var pref = en ? [/^en[-_]GB/i, /^en[-_]US/i, /^en/i] : [/^tr/i];
      voice = null;
      for (var i = 0; i < pref.length && !voice; i++) voice = vs.filter(function (v) { return pref[i].test(v.lang); })[0] || null;
    } catch (e) {}
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(text) {
    if (!soundOn || !window.speechSynthesis || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text); u.lang = voice ? voice.lang.replace('_', '-') : I18N.lang === 'en' ? 'en-GB' : 'tr-TR'; if (voice) u.voice = voice; u.rate = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function setSound(on) {
    soundOn = on; localStorage.setItem('fit-sound', on ? '1' : '0');
    if (!on && window.speechSynthesis) speechSynthesis.cancel();
    var b = $('wkSound'); if (b) { b.textContent = on ? '🔊' : '🔇'; b.setAttribute('aria-label', T(on ? 'snd.off' : 'snd.on')); }
  }
  var saidKey = '';
  function announce(st, key) {
    if (key === saidKey) return; saidKey = key;
    // voice only names the move; everything else (start, side switch, rest over, done) is a tone
    if (!st) return;
    if (st.type === 'list') { var it = itemOf(st), e = X(it.slug); say(it.name || e.name || ''); }
    else if (st.type === 'exercise') { var x = X(st.slug); say(st.name || x.name || ''); }
  }
  var wakeLock = null;
  function lockOn() {
    if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible' || !ROOT.open) return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {});
  }
  function lockOff() { if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; } }

  /* ---------- targets and last time ---------- */
  function repHi(st) { var m = String(st.reps || '').match(/^\s*(\d+)(?:\s*[–-]\s*(\d+))?/); return m ? +(m[2] || m[1]) : (st.holdSec ? st.holdSec[1] : 0); }
  function repLo(st) { var m = String(st.reps || '').match(/^\s*(\d+)/); return m ? +m[1] : (st.holdSec ? st.holdSec[0] : 8); }
  function amountTxt(st) {
    if (st.holdSec) return st.holdSec[0] + '–' + st.holdSec[1] + T('u.s') + (st.perSide ? T('u.side') : '');
    var r = String(st.repsText || st.reps || ''), m = r.match(/^([\d–\-\s]+)(.*)$/);
    return m ? m[1].trim() + T('u.reps') + (m[2].trim() ? ' ' + m[2].trim() : '') : r;
  }
  function lastInfo(st) {
    var h = hist[st.slug]; if (!h || !h.sets.length) return null;
    var sets = h.sets, reps = sets.map(function (x) { return +x.reps || 0; });
    var kg = Math.max.apply(null, sets.map(function (x) { return +x.kg || 0; }));
    var same = reps.every(function (r) { return r === reps[0]; });
    var txt = (same ? sets.length + '×' + reps[0] : reps.join(' / ')) + (st.holdSec ? T('u.s') : '') + (kg ? ' @ ' + fmt(kg) + ' kg' : '');
    var hi = repHi(st), good = sets.every(function (x) { return x.form !== false; });
    var up = !st.holdSec && hi > 0 && sets.length >= (st.sets || 1) && reps.every(function (r) { return r >= hi; }) && good;
    return { txt: txt, up: up, kg: kg, date: h.date };
  }
  function kgStep(slug) { var e = EX[slug] || {}; return (e.equipment || []).some(function (q) { return /dambıl/.test(q); }) ? 1 : 2.5; }
  // the value shown for set i: typed, else the previous set's, else last time's same set
  function suggest(st, e, i, f) {
    var w = e.work[i]; if (w[f] !== '' && w[f] != null) return String(w[f]);
    for (var j = i - 1; j >= 0; j--) if (e.work[j][f] !== '' && e.work[j][f] != null) return String(e.work[j][f]);
    var h = hist[st.slug]; if (h && h.sets.length) { var r = h.sets[Math.min(i, h.sets.length - 1)]; if (r && r[f] != null) return fmt(r[f]); }
    return '';
  }
  function setTxt(st, w) {
    var r = num(w.reps), k = num(w.kg);
    if (r == null && k == null) return '✓';
    return (k ? fmt(k) + '×' : '') + (r == null ? '—' : fmt(r)) + (st.holdSec ? T('u.s') : '');
  }

  /* ---------- workout navigation ---------- */
  var cardKey = '', sel = -1;
  // auto: start the next move's timer after PREP seconds (routines keep running once started)
  function go(i, auto) {
    var n = steps().length, s = S();
    i = Math.max(0, Math.min(n, i));
    if (i === s.step) return;
    if (auto === undefined) auto = isRoutine() && s.hold && !s.hold.paused;
    touch();
    s.step = i; s.hold = null; s.rest = null; sel = -1;
    var nx = steps()[i];
    if (auto && nx && nx.type === 'list' && itemOf(nx).holdSec) s.hold = holdNew(itemOf(nx), PREP);
    save(); renderWk();
    if (i >= n) finish();
  }
  function finish() {
    var s = S(); if (!s.t1) { s.t1 = Date.now(); cue('finish'); }
    if (isRoutine()) markMob(ROOT.session); else saveLog();
    save(); renderWk();
  }
  function listIdx(st) { return S().list[st.id] || 0; }
  function itemOf(st) { return st.items[listIdx(st)] || st.items[0]; }
  function nextListItem(st) {
    var s = S(), i = listIdx(st), auto = isRoutine() && s.hold && !s.hold.paused;
    s.hold = null;
    if (i + 1 >= st.items.length) { go(s.step + 1, auto); return; }
    s.list[st.id] = i + 1; save(); renderWk();
  }
  function prevListItem(st) { var s = S(), i = listIdx(st); s.hold = null; s.list[st.id] = Math.max(0, i - 1); save(); renderWk(); }
  function cardioState(st) {
    var s = S();
    if (!s.cardio[st.id]) s.cardio[st.id] = { min: st.lo || st.min, total: 0, endAt: 0, left: 0, running: false, beeped: false };
    return s.cardio[st.id];
  }
  function cardioLeft(c) { return c.running ? (c.endAt - Date.now()) / 1000 : (c.total ? c.left / 1000 : c.min * 60); }
  function cardioToggle(st) {
    var c = cardioState(st); touch();
    if (c.running) { c.left = c.endAt - Date.now(); c.running = false; }
    else {
      if (!c.total) { c.total = c.min * 60000; c.left = c.total; c.beeped = false; }
      c.endAt = Date.now() + c.left; c.running = true;
    }
    save(); renderWk();
  }
  function cardioAdj(st, d) {
    var c = cardioState(st);
    if (c.total || c.running) { var add = d * 60000; if (c.running) c.endAt += add; else c.left += add; c.min = Math.max(1, c.min + d); }
    else c.min = Math.max(1, Math.min(60, c.min + d));
    save(); renderWk();
  }
  function cardioReset(st) { var c = cardioState(st); c.total = 0; c.running = false; c.beeped = false; save(); renderWk(); }
  // hold timer of a list item: {start, sec, side, sides, go, paused}. Before `start` is the "Hazırlan" pause;
  // perSide items run the timer once per side with a SIDE_PREP pause between.
  function holdNew(it, prep) {
    return { start: Date.now() + (prep || 0) * 1000, sec: it.holdSec, side: 0, sides: it.perSide ? 2 : 1, go: prep ? 0 : 1, paused: 0 };
  }
  function holdView(h, now) { var el = ((h.paused || now) - h.start) / 1000; return { prep: el < 0, left: el < 0 ? -el : Math.max(0, h.sec - el) }; }
  function holdToggle(st) {
    var s = S(), h = s.hold; touch();
    if (!h) s.hold = holdNew(itemOf(st), isRoutine() ? 3 : 0);
    else if (h.paused) { h.start += Date.now() - h.paused; h.paused = 0; }
    else h.paused = Date.now();
    save(); renderWk();
  }
  function sideTxt(h, it) { return it.perSide ? T((h && h.side) ? 'side.r' : 'side.l') : ''; }
  function nextWork(e) { for (var i = 0; i < e.work.length; i++) if (!e.work[i].done) return i; return -1; }
  function selIdx(e) { if (sel >= 0 && sel < e.work.length) return sel; var n = nextWork(e); return n >= 0 ? n : e.work.length - 1; }
  function setDone(st, i) {
    var e = exState(st), w = e.work[i], s = S(); touch();
    if (st.perSide && !w.sides[0]) { w.sides[0] = 1; s.rest = null; save(); renderCtl(); return; }
    if (w.kg === '') w.kg = suggest(st, e, i, 'kg');
    if (w.reps === '') w.reps = suggest(st, e, i, 'reps');
    if (w.sides) w.sides = [1, 1];
    w.done = 1;
    if (nextWork(e) >= 0 && st.restSec) s.rest = { start: Date.now(), lo: st.restSec[0], hi: st.restSec[1], beeped: 0 };
    else s.rest = null;
    sel = nextWork(e);
    saveLog(); save(); renderCtl();
  }
  function undoSet(st, i) {
    var e = exState(st), w = e.work[i];
    w.done = 0; if (w.sides) w.sides = [0, 0];
    S().rest = null; sel = i; saveLog(); save(); renderCtl();
  }
  function primary() {
    var st = cur(), s = S(); unlock();
    if (!st) { closeWk(); return; }
    if (st.type === 'cardio') cardioToggle(st);
    else if (st.type === 'list') {
      var it = itemOf(st);
      if (it.holdSec) holdToggle(st); else nextListItem(st);
    } else {
      var e = exState(st), i = selIdx(e);
      if (!e.work[i].done) setDone(st, i);
      else if (nextWork(e) >= 0) { sel = nextWork(e); renderCtl(); }
      else go(s.step + 1);
    }
  }
  function next() {
    var st = cur(), s = S(); unlock();
    if (st && st.type === 'list' && listIdx(st) + 1 < st.items.length) { nextListItem(st); return; }
    go(s.step + 1);
  }
  function back() {
    var st = cur(), s = S(); unlock();
    if (st && st.type === 'list' && listIdx(st) > 0) { prevListItem(st); return; }
    go(s.step - 1);
  }

  /* ---------- workout render ---------- */
  function cardHtml(st) {
    if (st.type === 'cardio') return '<fl-exercise slug="' + esc(st.slug || 'bike') + '" bare compact media="photo,anim" size="m"></fl-exercise>';
    if (st.type === 'list') {
      var it = st.items[listIdx(st)];
      return '<fl-exercise slug="' + esc(it.slug) + '" bare compact media="photo,anim" size="m"></fl-exercise>';
    }
    return '<fl-exercise slug="' + esc(st.slug) + '" bare compact media="photo,anim" size="m"></fl-exercise>';
  }
  function cuesHtml(slug) {
    var e = TX.ex(slug); if (!e || !((e.cues || []).length || e.avoid)) return '';
    return '<details class="cues"><summary>' + T('cues') + '</summary><ul>' +
      (e.cues || []).map(function (c) { return '<li><b>' + T('cue.do') + '</b> ' + esc(c) + '</li>'; }).join('') +
      (e.avoid ? '<li><b>' + T('cue.avoid') + '</b> ' + esc(e.avoid) + '</li>' : '') + '</ul></details>';
  }
  function primLabel(st) {
    if (!st) return [T('b.close'), ''];
    if (st.type === 'cardio') { var c = cardioState(st); return [T(c.running ? 'b.pause' : c.total ? 'b.resume' : 'b.start'), '']; }
    if (st.type === 'list') {
      var it = itemOf(st), last = listIdx(st) + 1 >= st.items.length, h = S().hold;
      if (it.holdSec) return [h ? T(h.paused ? 'b.resume' : 'b.pause') : isRoutine() ? T('b.start') : T('b.startSec', it.holdSec), h ? '' : 'good'];
      return [T(last ? 'b.nextStep' : 'b.nextMove'), ''];
    }
    var e = exState(st), i = selIdx(e), w = e.work[i];
    if (!w.done) return [st.perSide ? T(w.sides[0] ? 'b.rightDone' : 'b.leftDone') : T('b.setDone', i + 1), 'good'];
    if (nextWork(e) >= 0) return [T('b.nextSet'), 'alt'];
    return [T(S().step >= steps().length - 1 ? 'b.finishSes' : 'b.nextMove'), ''];
  }
  function stepper(f, label, sub, val, ph) {
    return '<div class="stp"><span class="l">' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span>' +
      '<button type="button" data-act="dec" data-f="' + f + '" aria-label="' + esc(T('dec', label)) + '">−</button>' +
      '<input data-f="' + f + '" inputmode="' + (f === 'kg' ? 'decimal' : 'numeric') + '" enterkeyhint="done" autocomplete="off" value="' + esc(val) + '" placeholder="' + esc(ph) + '" aria-label="' + label + '">' +
      '<button type="button" data-act="inc" data-f="' + f + '" aria-label="' + esc(T('inc', label)) + '">+</button></div>';
  }
  function ctlHtml(st) {
    var s = S();
    if (!st && isRoutine()) {
      return '<div class="done"><h2>' + esc(T('rt.done', M(ROOT.session).title)) + '</h2><p>' + T('time', mmss(((s.t1 || Date.now()) - (s.t0 || Date.now())) / 1000)) + '</p>' +
        '<p class="msg ok">' + T('rt.marked') + '</p><p class="muted">' + esc(mobWeekTxt()) + '</p></div>';
    }
    if (!st) {
      var recs = records(), by = {};
      recs.forEach(function (r) { (by[r.exercise] = by[r.exercise] || []).push(r); });
      return '<div class="done"><h2>' + T('ses.done') + '</h2><p>' + T('ses.sum', recs.length, mmss(((s.t1 || Date.now()) - (s.t0 || Date.now())) / 1000)) +
        '</p><p class="msg ok">' + T('ses.saved') + '</p>' +
        (recs.length ? '<ul>' + Object.keys(by).map(function (slug) {
          var st0 = steps().filter(function (x) { return x.slug === slug; })[0] || {};
          return '<li><span>' + esc(X(slug).name || slug) + '</span><span>' + by[slug].map(function (r) { return setTxt(st0, r); }).join(', ') + '</span></li>';
        }).join('') + '</ul>' : '') + '</div>';
    }
    if (st.type === 'cardio') {
      var c = cardioState(st), left = cardioLeft(c), started = c.total > 0;
      return '<div class="target"><div class="t2">' + esc(st.detail || '') + '</div></div>' +
        '<div class="timer"><div class="tv' + (left < 0 ? ' over' : '') + '" id="cardioT">' + (left < 0 ? '+' : '') + mmss(Math.abs(left)) + '</div>' +
        '<div class="tl" id="cardioL">' + (left < 0 ? T('c.over') : started ? T(c.running ? 'c.run' : 'c.paused') : T('c.target', st.lo || st.min, st.hi)) + '</div>' +
        '<div class="adj"><button class="btn" data-act="cm" type="button" aria-label="' + T('c.minus') + '">−1</button><span>' + c.min + T('u.min') + '</span><button class="btn" data-act="cp" type="button" aria-label="' + T('c.plus') + '">+1</button></div></div>' +
        (started ? '<button class="btn" data-act="cr" type="button">' + T('b.reset') + '</button>' : '');
    }
    if (st.type === 'list') {
      var i = listIdx(st), it = st.items[i], h = s.hold, out = '', ent = X(it.slug), rt = isRoutine();
      if (rt) {
        var kind = T(ent.kind === 'dynamic' ? 'k.dyn' : 'k.stat');
        out += '<div class="target"><div class="t1">' + esc(it.dose || '') + '</div><div class="t3">' + (it.optional ? T('opt') : '') + (it.tip ? esc(I18N.cap(it.tip)) + '. ' : '') + (it.perSide ? T('both') : '') + kind + '</div></div>';
      } else out += '<div class="listn">' + esc(ent.name || it.name || it.slug) + ' · ' + (i + 1) + ' / ' + st.items.length + (it.perSide ? T('lr') : '') + '</div>';
      if (it.holdSec) {
        var v = h ? holdView(h, Date.now()) : { prep: false, left: it.holdSec }, side = sideTxt(h, it);
        var lab = v.prep ? T(h.side ? 'switch' : 'ready') + (side ? ' · ' + side : '') : T('u.sec') + (side ? ' · ' + side : !it.perSide && /taraf|side/.test(it.dose || '') ? T('eachSide') : '');
        out += '<div class="timer' + (v.prep ? ' prep' : '') + (h && h.paused ? ' paused' : '') + '"><div class="tv" id="holdT">' + Math.ceil(v.left) + '</div><div class="tl" id="holdL">' + esc(lab) + (h && h.paused ? T('pausedL') : '') + '</div></div>';
      } else {
        out += '<div class="target"><div class="t1">' + esc(it.dose || '') + '</div><div class="t3">' + (it.perSide ? T('lrSide') : '') + T('slow') + '</div></div>';
      }
      var lastStep = S().step >= steps().length - 1 && i + 1 >= st.items.length;
      if (it.holdSec) out += '<button class="btn" data-act="lnext" type="button">' + T(rt ? (lastStep ? 'b.finish' : 'b.nextMove') : i + 1 >= st.items.length ? 'b.nextStep' : 'b.nextMove') + '</button>';
      return out + cuesHtml(it.slug);
    }
    // exercise
    var e = exState(st), si = selIdx(e), w = e.work[si], li = lastInfo(st), ex = X(st.slug), o = '';
    o += '<div class="target"><div class="t1">' + esc(T('sets', st.sets)) + ' × ' + esc(amountTxt(st)) + '</div>' +
      (ex.rir ? '<div class="t2">' + esc(ex.rir) + '</div>' : '') +
      '<div class="t3">' + T('rest', st.restSec ? (st.restSec[0] === st.restSec[1] ? mmss(st.restSec[0]) : mmss(st.restSec[0]) + '–' + mmss(st.restSec[1])) + T('u.min') : '—') + '</div>' +
      (li ? '<div class="last' + (li.up ? ' up' : '') + '">' + esc(T('last', li.txt)) + '</div>' + (li.up ? '<span class="hint">' + T('up') + '</span>' : '')
        : '<div class="last none">' + T('last.none') + '</div>') + '</div>';
    if (e.warm.length) {
      o += '<div><p class="sec">' + T('warmSets') + '</p><div class="chips">' + e.warm.map(function (d, k) {
        return '<button type="button" class="chip' + (d ? ' on' : '') + '" data-act="warm" data-i="' + k + '" aria-pressed="' + !!d + '">' + T('warmN', k + 1) + (d ? ' ✓' : '') + '</button>';
      }).join('') + '</div></div>';
    }
    var nw = nextWork(e);
    o += '<div><p class="sec">' + T('workSets') + '</p><div class="setgrid" style="--n:' + e.work.length + '">' + e.work.map(function (x, k) {
      var cls = 'setc' + (x.done ? ' on' : k === nw ? ' cur' : '') + (k === si ? ' sel' : '');
      var sub = x.done ? setTxt(st, x) : st.perSide && x.sides && x.sides[0] ? T('leftOk') : k === nw ? T('nextS') : '';
      return '<button type="button" class="' + cls + '" data-act="sel" data-i="' + k + '" aria-pressed="' + (k === si) + '">Set ' + (k + 1) + '<small>' + esc(sub) + '</small></button>';
    }).join('') + '</div></div>';
    var hs = hist[st.slug] && hist[st.slug].sets[si];
    o += '<div class="editor">' +
      stepper('kg', 'kg', '±' + fmt(kgStep(st.slug)), shown(w.kg !== '' ? w.kg : suggest(st, e, si, 'kg')), hs && hs.kg != null ? fmt(hs.kg) : '—') +
      stepper('reps', T(st.holdSec ? 'u.sec' : 'u.rep'), st.perSide ? T('u.perSide') : '', shown(w.reps !== '' ? w.reps : suggest(st, e, si, 'reps')), hs && hs.reps != null ? fmt(hs.reps) : String(repLo(st))) +
      '<div class="edhint"><span>' + (w.done ? T('set.saved', si + 1) : 'Set ' + (si + 1) + (st.perSide ? T('set.side') : '')) + '</span>' +
      (w.done ? '<button type="button" class="btn" data-act="undo" data-i="' + si + '">' + T('b.undo') + '</button>' : '') + '</div></div>';
    o += '<label class="formrow"><input type="checkbox" data-act="form"' + (e.form !== false ? ' checked' : '') + '> ' + T('form') + '</label>';
    return o + cuesHtml(st.slug);
  }
  function renderTopWk() {
    var k = ROOT.session, s = S(), st = steps(), c = cur(), info = window.FIT_blockInfo ? FIT_blockInfo() : { block: 1 };
    $('wk').dataset.session = k;
    if (isRoutine(k)) { $('wkSes').textContent = M(k).title; $('wkBlk').textContent = T('daily', META[k].min); }
    else {
      $('wkSes').textContent = (M(k).label || k) + ' · ' + sesName(k);
      $('wkBlk').textContent = T('block', info.block) + (info.week ? ' · ' + T('week', info.week) : '');
    }
    $('prog').innerHTML = st.map(function (x, i) {
      return '<button type="button" data-go="' + i + '" class="' + (i < s.step ? 'done' : i === s.step ? 'cur' : '') + '" aria-label="' + esc((i + 1) + '. ' + x.name) + '"></button>';
    }).join('');
    $('stepTitle').textContent = c ? c.name : T('ses.done');
    $('stepCount').textContent = c ? (s.step + 1) + ' / ' + st.length : '';
    $('backBtn').disabled = s.step === 0 && !(c && c.type === 'list' && listIdx(c) > 0);
    $('nextBtn').disabled = !c;
  }
  function renderPrim() {
    var p = primLabel(cur()), b = $('primBtn');
    b.textContent = p[0]; b.className = p[1];
  }
  function renderCtl() {
    var st = cur();
    $('ctl').innerHTML = ctlHtml(st);
    renderPrim(); tick();
  }
  function renderWk() {
    if (!ROOT.open) return;
    renderTopWk();
    var st = cur(), key = ROOT.session + '|' + block() + '|' + S().step + '|' + (st && st.type === 'list' ? listIdx(st) : '');
    if (key !== cardKey) {
      cardKey = key;
      announce(st, key);
      $('card').innerHTML = st ? cardHtml(st) : '';
      $('wkMain').scrollTop = 0;
    }
    renderCtl();
  }

  /* ---------- timers ---------- */
  function tick() {
    if (!ROOT.open) return;
    var s = S(), now = Date.now(), c;
    $('clock').textContent = s.t0 ? mmss(((s.t1 || now) - s.t0) / 1000) : '0:00';
    var st = cur(), box = $('restBox');
    if (st && st.type === 'exercise' && s.rest) {
      var r = s.rest, el = (now - r.start) / 1000, cls, label, val;
      if (el < r.lo) { cls = 'rest'; label = T('r.rest'); val = mmss(Math.ceil(r.lo - el)); }
      else if (el < r.hi) { cls = 'rest over'; label = T('r.over', mmss(r.hi)); val = '+' + mmss(el - r.lo); }
      else { cls = 'rest ready'; label = T('r.ready'); val = '+' + mmss(el - r.lo); }
      if (el >= r.lo && !r.beeped) { r.beeped = 1; save(); beep(2); }
      if (el >= r.hi && r.beeped < 2) { r.beeped = 2; save(); beep(1); }
      if (box.dataset.h !== cls + label) {
        box.dataset.h = cls + label;
        box.innerHTML = '<div class="' + cls + '"><div class="rx"><div class="rl">' + label + '</div><div class="rt">' + val + '</div></div><button class="rs" data-act="skip" type="button">' + T('b.skip') + '</button></div>';
      } else box.querySelector('.rt').textContent = val;
    } else if (box.innerHTML) { box.innerHTML = ''; box.dataset.h = ''; }
    if (!st) return;
    if (st.type === 'cardio') {
      c = cardioState(st);
      var left = cardioLeft(c), t = $('cardioT');
      if (c.running && t) {
        t.textContent = (left < 0 ? '+' : '') + mmss(Math.abs(left)); t.className = 'tv' + (left < 0 ? ' over' : '');
        if (left < 0 && !c.beeped) { c.beeped = true; save(); beep(3); var l = $('cardioL'); if (l) l.textContent = T('c.over'); }
      }
    } else if (st.type === 'list' && s.hold && !s.hold.paused) {
      var h = s.hold, v = holdView(h, now), ht = $('holdT');
      var secLeft = Math.ceil(v.left);
      if (secLeft <= 3 && secLeft >= 1 && h.ticked !== (v.prep ? -secLeft : secLeft)) { h.ticked = v.prep ? -secLeft : secLeft; cue('tick'); }
      if (!v.prep && !h.go) { h.go = 1; save(); cue('go'); renderCtl(); }                  // "Hazırlan" is over
      else if (!v.prep && v.left <= 0) {
        if ((h.side || 0) + 1 < (h.sides || 1)) { h.side = (h.side || 0) + 1; h.start = now + SIDE_PREP * 1000; h.go = 0; save(); cue('side'); renderCtl(); }
        else { cue('done'); nextListItem(st); }
      } else if (ht) ht.textContent = secLeft;
    }
  }

  /* ---------- open / close workout ---------- */
  function openWk(k) {
    unlock();
    if (k && SESS[k]) {
      if (isRoutine(k)) { if (ROOT.s[k] && ROOT.s[k].t1) delete ROOT.s[k]; } // a finished routine starts over
      else ROOT.last = k;
      ROOT.session = k;
    }
    ROOT.open = true; save();
    cardKey = ''; sel = -1;
    buildHistory();
    $('wk').hidden = false; document.body.classList.add('wk-open');
    renderWk(); lockOn();
  }
  function closeWk() {
    ROOT.open = false; save();
    $('wk').hidden = true; document.body.classList.remove('wk-open');
    $('card').innerHTML = ''; cardKey = '';
    lockOff(); renderToday(); renderHistory(); if (progSec === 'gunluk') renderProgram();
  }

  /* ---------- Bugün ---------- */
  function sesMin(k) { return Math.round(steps(k).reduce(function (a, x) { return a + x.min; }, 0)); }
  function blockLine() {
    var i = window.FIT_blockInfo ? FIT_blockInfo() : { block: 1 }, b = TX.block((window.FIT_BLOCKS || [])[i.block - 1]) || { name: T('block', i.block), weeks: '' };
    var wk = i.week == null ? T('noStart') : i.week === 0 ? T('starts', dayTxt(i.start)) : i.week > 12 ? T('weekDone', i.week) : T('Week', i.week);
    return '<div class="card blkline"><div><b>' + esc(b.name) + '</b> <span class="muted">· ' + T('wk') + ' ' + esc(b.weeks) + '</span><div class="muted">' + esc(wk) + (i.source === 'manual' ? T('manual') : '') + '</div></div>' +
      '<button type="button" class="btn" data-goto="program">' + T('change') + '</button></div>';
  }
  function sessionCard(k, lead, cta) {
    var m = M(k), st = steps(k), s = ROOT.s[k], prog = inProgress(k), fin = s && s.t1;
    var label = prog ? T('cont', Math.min(s.step, st.length - 1) + 1, st.length) : fin ? T('openSes') : cta;
    return '<div class="card hero" data-session="' + k + '">' + (lead ? '<div class="muted">' + esc(lead) + '</div>' : '') +
      '<h2>' + esc(sesName(k)) + ' — ' + esc((m.title || '').replace(/^(Gün|Day) [AB] — /, '')) + '</h2>' +
      '<div class="when">' + esc(m.label || k) + ' · ~' + sesMin(k) + T('u.min') + '</div>' +
      (fin ? '<p><span class="ok-badge">' + T('doneToday') + '</span> <span class="muted">' + esc(T('sets', records(k).length)) + ' · ' + mmss((s.t1 - s.t0) / 1000) + '</span></p>' : '') +
      '<ul class="steps-mini">' + st.map(function (x) {
        return '<li class="' + (x.phase === 'main' ? 'main' : 'warm') + '"><span>' + esc(x.name) + '</span><span>' + (x.sets ? x.sets + '×' + esc(x.holdSec ? x.holdSec[0] + '–' + x.holdSec[1] + T('u.s') : x.repsText || x.reps || '') : '~' + Math.round(x.min) + T('u.min')) + '</span></li>';
      }).join('') + '</ul>' +
      '<button type="button" class="big" data-start="' + k + '">' + esc(label) + '</button></div>';
  }
  // "Günlük esneme": Sabah and Akşam buttons; before 14:00 Sabah is the suggested one, later Akşam
  function mobCard() {
    var done = mobToday(), pick = new Date().getHours() < 14 ? 'sabah' : 'aksam';
    if (done[pick]) pick = ROUT.filter(function (k) { return !done[k]; })[0] || '';
    return '<div class="card mob"><div class="mobh"><h2>' + T('mob') + '</h2><span class="muted">' + T('everyDay') + '</span></div><div class="mobbtns">' + ROUT.map(function (k) {
      var m = M(k), st = steps(k), s = ROOT.s[k], prog = inProgress(k);
      var sub = done[k] ? T('mob.done') : prog ? T('cont', Math.min(s.step, st.length - 1) + 1, st.length) : '~' + m.min + T('u.min') + ' · ' + T(k === 'sabah' ? 'dyn' : 'stat');
      return '<button type="button" class="mobbtn' + (k === pick ? ' pick' : '') + (done[k] ? ' done' : '') + '" data-session="' + k + '" data-start="' + k + '"' + (k === pick ? ' aria-describedby="mobPick"' : '') + '>' +
        '<b>' + esc(m.label || k) + '</b><small>' + esc(sub) + '</small></button>';
    }).join('') + '</div><p class="muted" id="mobPick">' + esc(mobWeekTxt()) + '</p></div>';
  }
  function lastSessionLine() {
    var log = readLog(); if (!log.length) return '';
    var r = log.reduce(function (a, b) { return !a || b.date > a.date ? b : a; }, null);
    return '<p class="muted">' + esc(T('lastWo', dayTxt(r.date, true) + ' · ' + (sesName(r.session) || r.session || ''))) + '</p>';
  }
  function renderToday() {
    var d = new Date(), dow = d.getDay(), out = '';
    out += '<div class="titlerow"><div class="date">' + esc(I18N.day(d, { dow: 'first' })) + '</div>' + I18N.switchHtml() + '</div>';
    var running = GYM.filter(inProgress)[0];
    var todayKey = dow === 2 ? 'sali' : dow === 5 ? 'cuma' : null;
    // gym days (or a running lift session): the session card first, then the daily routines
    if (running && running !== todayKey) {
      out += '<h1 class="title">' + T('running') + '</h1><div class="stack">' + sessionCard(running, '', T('contShort')) + mobCard();
    } else if (todayKey) {
      out += '<h1 class="title">' + esc(T('today', sesName(todayKey))) + '</h1><div class="stack">' + sessionCard(todayKey, '', T('startWo')) + mobCard();
    } else if (dow === 0) {
      out += '<h1 class="title">' + esc(T('today', I18N.weekday(0))) + '</h1><div class="stack">' + mobCard() + '<div class="card hero" data-session="warm"><h2>' + T('z2') + '</h2>' +
        '<ul class="steps-mini"><li class="warm"><span>' + T('z2.pace') + '</span><span>' + T('z2.min') + '</span></li></ul>' +
        '<p class="muted">' + T('z2.str') + '</p></div>';
    } else {
      var n = 1, nd; for (; n <= 7; n++) { nd = (dow + n) % 7; if (nd === 2 || nd === 5) break; }
      var nk = nd === 2 ? 'sali' : 'cuma';
      out += '<h1 class="title">' + T('restDay') + '</h1><div class="stack">' + mobCard() + sessionCard(nk, T('nextDay', I18N.weekday(nd), n === 1 ? T('tomorrow') : T('inDays', n)), T('anyway'));
    }
    out += blockLine();
    out += '<div><p class="sec">' + T('anyway') + '</p><div class="anyway">' + GYM.map(function (k) {
      return '<button type="button" class="btn" data-start="' + k + '" data-ses="' + k + '">' + esc(sesName(k)) + ' <span class="muted">· ' + esc(M(k).label || k) + '</span></button>';
    }).join('') + '</div></div>' + lastSessionLine() + '</div>';
    $('v-bugun').innerHTML = out;
    $('v-bugun').dataset.session = todayKey || (running) || 'sali';
  }

  /* ---------- Program ---------- */
  var progSec = 'sali', openSlots = {};
  function exRow(attrs, idx, name, dose, blk, key) {
    return '<details class="exd" data-key="' + esc(key) + '"' + (openSlots[key] ? ' open' : '') + '><summary><span class="n">' + idx + '</span><span class="nm"><b>' + esc(name) + '</b><small>' + esc(dose || '') +
      (blk ? ' · <i>' + esc(blk) + '</i>' : '') + '</small></span></summary><div class="body" data-attrs="' + esc(attrs) + '"></div></details>';
  }
  function renderProgram() {
    var sec = progSec, out = '';
    $('v-program').dataset.session = sec === 'gunluk' ? 'sabah' : sec;
    document.querySelectorAll('.segctl button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.sec === sec)); });
    $('v-program').querySelector('.picker').hidden = sec === 'warm' || sec === 'gunluk';
    if (sec === 'gunluk') {
      out += '<div class="shead"><h2>' + T('mob') + '</h2><span class="when">' + T('g.when', META.sabah.min, META.aksam.min) + '</span>' +
        '<p>' + T('g.p') + '</p></div>' +
        ROUT.map(function (k) {
          var m = M(k), done = mobToday()[k];
          return '<div class="rtn" data-session="' + k + '"><h2 class="fit-sec">' + esc(m.title) + ' <span class="fit-dur">~' + m.min + T('u.min') + (done ? T('g.todayOk') : '') + '</span></h2><div class="exlist">' +
            steps(k).map(function (x, i) {
              var it = x.items[0], e = X(it.slug);
              return exRow('slug="' + it.slug + '" index="' + (i + 1) + '" dose="' + esc(it.dose) + '"', i + 1, e.name || it.slug, x.detail, '', k + ':' + it.slug);
            }).join('') + '</div><button type="button" class="big" data-start="' + k + '">' + esc(T('g.start', m.title)) + '</button></div>';
        }).join('') +
        '<p class="muted">' + T('g.src') + '</p>';
    } else if (sec === 'warm') {
      var A = ['bike', 'leg-swing', 'worlds-greatest-stretch', 'arm-circles', 'stick-pass-through', 'bodyweight-squat', 'cat-cow'];
      var B = ['pancake-stretch', 'figure-4-stretch', 'hip-flexor-reach', 'lat-stretch-rail', 'quad-stretch', 'chest-doorway-stretch'];
      var row = function (slug, i, grp) { var e = X(slug); return exRow('slug="' + slug + '" index="' + (i + 1) + '"', i + 1, e.name || slug, e.dose, '', grp + slug); };
      out += '<div class="shead"><h2>' + T('w.h') + '</h2><span class="when">' + T('w.when') + '</span>' +
        '<p>' + T('w.p', '<a href="https://www.youtube.com/shorts/gcv9Hj-Bud8" target="_blank" rel="noopener">MovementbyDavid</a>') + '</p></div>' +
        '<h2 class="fit-sec">' + T('w.start') + '</h2><div class="exlist">' + A.map(function (s, i) { return row(s, i, 'w:'); }).join('') + '</div>' +
        '<p class="muted">' + T('w.sets') + '</p>' +
        '<h2 class="fit-sec">' + T('w.cool') + '</h2><div class="exlist">' + B.map(function (s, i) { return row(s, i, 'c:'); }).join('') + '</div>' +
        '<p class="muted">' + T('w.coolp') + '</p>';
    } else {
      var m = M(sec), st = steps(sec), n = 0;
      out += '<div class="shead"><h2>' + esc(m.title || '') + '</h2><span class="when">' + esc(m.label || sec) + ' · ~' + sesMin(sec) + T('u.min') + '</span>' +
        '<p>' + T('s.p') + '</p></div>' +
        '<fl-session-timeline session="' + sec + '"></fl-session-timeline>' +
        '<h2 class="fit-sec">' + T('s.ex') + '</h2><div class="exlist">' + st.filter(function (x) { return x.type === 'exercise'; }).map(function (x) {
          n++;
          var b = x.variants && TX.block((window.FIT_BLOCKS || [])[x.block - 1]);
          return exRow('session="' + sec + '" step="' + x.slot + '" index="' + n + '"', n, x.name, x.dose || X(x.slug).dose, b ? b.name + ' · ' + T('wk') + ' ' + b.weeks : '', sec + ':' + x.slot);
        }).join('') + '</div>' +
        '<button type="button" class="big" style="margin-top:16px" data-start="' + sec + '">' + esc(T('s.start', sesName(sec))) + '</button>';
    }
    $('progBody').innerHTML = out;
    $('progBody').querySelectorAll('details.exd[open]').forEach(fillEx);
    var tl = $('progBody').querySelector('fl-session-timeline');
    if (tl) tl.addEventListener('stepclick', function (ev) {
      var s = ev.detail.step, d = $('progBody').querySelector('details[data-key="' + sec + ':' + s.slot + '"]');
      if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }
  function fillEx(d) {
    var body = d.querySelector('.body');
    if (!body.firstChild) body.innerHTML = '<fl-exercise ' + body.dataset.attrs + ' media="photo,video,anim"></fl-exercise>';
  }
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (!d.classList || !d.classList.contains('exd')) return;
    openSlots[d.dataset.key] = d.open;
    if (d.open) fillEx(d);
  }, true);

  /* ---------- Geçmiş ---------- */
  var ORDER = [];
  Object.keys(SESS).forEach(function (k) { [1, 2, 3].forEach(function (b) { (window.FIT_sessionSteps ? FIT_sessionSteps(k, b) : []).forEach(function (s) { if (s.type === 'exercise' && ORDER.indexOf(s.slug) < 0) ORDER.push(s.slug); }); }); });
  function stepFor(slug) {
    var found = null;
    Object.keys(SESS).some(function (k) { return [1, 2, 3].some(function (b) { return FIT_sessionSteps(k, b).some(function (s) { if (s.slug === slug && s.type === 'exercise') { found = s; return true; } return false; }); }); });
    return found || {};
  }
  function renderHistory() {
    buildHistory();
    var log = readLog(), out = '';
    var mob = '<div class="card mobweek"><b>' + T('mob') + '</b><span>' + esc(mobWeekTxt()) + '</span></div>';
    if (!log.length) { $('histBody').innerHTML = mob + '<div class="empty">' + T('h.empty') + '</div>'; return; }
    out += mob;
    var slugs = Object.keys(hist).sort(function (a, b) { return (ORDER.indexOf(a) + 1 || 999) - (ORDER.indexOf(b) + 1 || 999); });
    out += '<h2 class="fit-sec">' + T('h.last') + '</h2><div class="card lastlist">' + slugs.map(function (slug) {
      var li = lastInfo(stepFor(slug)), h = hist[slug];
      return '<div class="row"><div><b>' + esc(X(slug).name || slug) + '</b><small>' + esc(dayTxt(h.date, true)) + '</small></div><div class="val">' + esc(li ? li.txt : '') +
        (li && li.up ? '<span class="up">' + T('up') + '</span>' : '') + '</div></div>';
    }).join('') + '</div>';
    var groups = {};
    log.forEach(function (r) { var k = r.date + '|' + (r.session || ''); (groups[k] = groups[k] || []).push(r); });
    var keys = Object.keys(groups).sort().reverse();
    out += '<h2 class="fit-sec">' + T('h.ses') + ' <span class="fit-dur">' + keys.length + '</span></h2>' + keys.map(function (k) {
      var g = groups[k], r0 = g[0], by = {}, order = [];
      g.forEach(function (r) { if (!by[r.exercise]) { by[r.exercise] = []; order.push(r.exercise); } by[r.exercise].push(r); });
      var live = r0.date === ROOT.date && inProgress(r0.session);
      return '<details class="ses" data-session="' + esc(r0.session || 'sali') + '"><summary><span class="nm"><b>' + esc(dayTxt(r0.date, true)) + ' · ' + esc(sesName(r0.session) || r0.session || '') + '</b>' +
        '<small>' + (r0.block ? esc(T('block', r0.block)) + ' · ' : '') + esc(T('h.count', order.length, g.length)) + (live ? T('h.live') : '') + '</small></span></summary><div class="body">' +
        order.map(function (slug) {
          var st = stepFor(slug), sets = by[slug].sort(function (a, b) { return a.set - b.set; });
          return '<p><b>' + esc(X(slug).name || slug) + '</b><br><span class="sets">' + sets.map(function (r) { return setTxt(st, r); }).join(', ') +
            (sets.some(function (r) { return r.form === false; }) ? T('h.badForm') : '') + '</span></p>';
        }).join('') + '</div></details>';
    }).join('');
    $('histBody').innerHTML = out;
    var bk = localStorage.getItem('fit-backup'), days = bk ? Math.floor((Date.now() - Date.parse(bk)) / 864e5) : null;
    if (days === null || days >= 14) histMsg(days === null ? T('h.noBackup') : T('h.oldBackup', days), 'err');
    else histMsg('', '');
  }
  function histMsg(t, cls) { var m = $('histMsg'); m.textContent = t; m.className = 'msg ' + (cls || ''); }
  $('exportBtn').addEventListener('click', function () {
    var log = readLog();
    if (!log.length) { histMsg(T('h.noExport'), 'err'); return; }
    var text = '[\n' + log.map(function (r) { return JSON.stringify(r); }).join(',\n') + '\n]\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'antrenman-log-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    localStorage.setItem('fit-backup', new Date().toISOString());
    histMsg(T('h.exported', log.length), 'ok');
  });
  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      var recs = null;
      try { var j = JSON.parse(t); recs = Array.isArray(j) ? j : j && Array.isArray(j.log) ? j.log : null; } catch (e) { recs = null; }
      if (!recs) recs = String(t).split('\n').map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }); // JSONL (antrenman-log.jsonl)
      recs = recs.filter(function (r) { return r && typeof r === 'object' && r.date && r.exercise && parseDay(r.date); });
      if (!recs.length) { histMsg(T('h.noRec'), 'err'); return; }
      var key = function (r) { return r.date + '|' + r.session + '|' + r.exercise + '|' + r.set; }, map = {};
      readLog().forEach(function (r) { map[key(r)] = r; });
      recs.forEach(function (r) { map[key(r)] = r; });
      var all = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      writeLog(all);
      if (!localStorage.getItem('fit-start')) { // same rule as exercise-data.js: first Tuesday on or after the first session
        var d = parseDay(all[0].date); while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
        if (window.FIT_setStart) FIT_setStart(iso(d));
      }
      histMsg(T('h.imported', recs.length), 'ok');
      renderHistory(); renderToday();
    }).catch(function (e) { histMsg(T('h.readErr', e && e.message || e), 'err'); });
    ev.target.value = '';
  });

  /* ---------- Kurallar ---------- */
  // 3-month plan: one block at a time, each day's exercises; rotating ones bold, "yeni" when they change
  var planB = 0;
  function renderRules() {
    var i = window.FIT_blockInfo ? FIT_blockInfo() : { block: 1 }, b = planB || i.block;
    $('nowBlock').textContent = T('k.now', i.block) + (i.week ? ' · ' + T('week', Math.min(i.week, 99)) : '');
    document.querySelectorAll('#planSeg button').forEach(function (el) {
      el.setAttribute('aria-selected', String(+el.dataset.b === b));
      el.classList.toggle('cur', +el.dataset.b === i.block);
    });
    $('planBody').innerHTML = ['sali', 'cuma'].map(function (k) {
      var prev = b > 1 ? FIT_sessionSteps(k, b - 1) : null;
      return '<div class="plan-day" style="--fit-accent:var(--fit-' + k + ')"><h3>' + esc(M(k).label) + ' · ' + esc(sesName(k)) + '</h3><ul>' +
        TX.steps(k, b).filter(function (s) { return s.type === 'exercise'; }).map(function (s) {
          var rot = !!(FIT_SESSIONS[k].filter(function (o) { return o.id === s.slot; })[0] || {}).variants,
            isNew = prev && prev.some(function (p) { return p.slot === s.slot && p.id !== s.id; });
          return '<li class="' + (rot ? 'rot' : 'fix') + '">' + esc(s.name) + (isNew ? '<span class="new">' + T('k.new') + '</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('') + '<p class="plan-key">' + T('k.key') + '</p>';
  }
  document.querySelectorAll('#planSeg button').forEach(function (el) {
    el.addEventListener('click', function () { planB = +el.dataset.b; renderRules(); });
  });

  /* ---------- tabs and routing ---------- */
  var TABS = ['bugun', 'program', 'gecmis', 'kurallar'];
  function route() {
    var h = (location.hash || '').replace(/^#/, '').split('/'), t = TABS.indexOf(h[0]) >= 0 ? h[0] : 'bugun';
    if (t === 'program' && h[1] && /^(sali|cuma|warm|gunluk)$/.test(h[1]) && h[1] !== progSec) { progSec = h[1]; renderProgram(); }
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.dataset.view !== t; });
    document.querySelectorAll('.tabbar button').forEach(function (b) { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (t === 'bugun') renderToday();
    if (t === 'gecmis') renderHistory();
    window.scrollTo(0, 0);
  }
  function goto(h) { if (location.hash === '#' + h) route(); else location.hash = h; }
  window.addEventListener('hashchange', route);

  /* ---------- events ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-tab],[data-start],[data-goto],[data-sec],[data-go],[data-act]'); if (!t) return;
    if (t.dataset.tab) return goto(t.dataset.tab);
    if (t.dataset.start) return openWk(t.dataset.start);
    if (t.dataset.goto) { var p = t.dataset.goto.split('/'); if (p[1]) { progSec = p[1]; renderProgram(); } return goto(p[0]); }
    if (t.dataset.sec) { progSec = t.dataset.sec; renderProgram(); window.history.replaceState(null, '', '#program/' + progSec); return; }
    if (!ROOT.open) return;
    unlock();
    var st = cur(), s = S();
    if (t.dataset.go != null) return go(+t.dataset.go);
    var a = t.dataset.act, i = +t.dataset.i;
    if (a === 'lnext') nextListItem(st);
    else if (a === 'cm') cardioAdj(st, -1);
    else if (a === 'cp') cardioAdj(st, 1);
    else if (a === 'cr') cardioReset(st);
    else if (a === 'skip') { s.rest = null; save(); tick(); }
    else if (a === 'warm') { touch(); var e = exState(st); e.warm[i] = e.warm[i] ? 0 : 1; save(); renderCtl(); }
    else if (a === 'sel') { sel = i; renderCtl(); }
    else if (a === 'undo') undoSet(st, i);
    else if (a === 'form') { exState(st).form = t.checked; saveLog(); save(); }
    else if (a === 'inc' || a === 'dec') {
      var ex = exState(st), k = selIdx(ex), f = t.dataset.f, w = ex.work[k];
      var v = num(w[f] !== '' ? w[f] : suggest(st, ex, k, f)), step = f === 'kg' ? kgStep(st.slug) : st.holdSec ? 5 : 1;
      if (v == null) v = a === 'inc' ? (f === 'kg' ? 0 : repLo(st) - step) : (f === 'kg' ? 0 : repLo(st) + step);
      v = Math.max(0, Math.round((v + (a === 'inc' ? step : -step)) * 100) / 100);
      w[f] = fmt(v); touch();
      var inp = $('ctl').querySelector('input[data-f="' + f + '"]'); if (inp) inp.value = w[f];
      if (w.done) saveLog();
      save(); var sc = $('ctl').querySelectorAll('.setc')[k]; if (sc && w.done) sc.querySelector('small').textContent = setTxt(st, w);
    }
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target; if (!ROOT.open || !el.dataset || !el.dataset.f) return;
    var st = cur(); if (!st || st.type !== 'exercise') return;
    var e = exState(st), k = selIdx(e); e.work[k][el.dataset.f] = el.value.trim(); touch();
    if (e.work[k].done) saveLog();
    save();
  });
  $('primBtn').addEventListener('click', primary);
  $('nextBtn').addEventListener('click', next);
  $('backBtn').addEventListener('click', back);
  $('wkClose').addEventListener('click', closeWk);
  $('wkSound').addEventListener('click', function () { unlock(); setSound(!soundOn); });
  setSound(soundOn);
  document.addEventListener('keydown', function (ev) {
    if (!ROOT.open) return;
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === ' ') { ev.preventDefault(); primary(); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); next(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); back(); }
    else if (ev.key === 'Escape') closeWk();
  });
  // swipe left / right between steps
  var sw = null;
  $('wkMain').addEventListener('touchstart', function (ev) {
    var t = ev.touches[0]; sw = ev.touches.length === 1 && !ev.target.closest('input,.stp') ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  }, { passive: true });
  $('wkMain').addEventListener('touchend', function (ev) {
    if (!sw) return; var t = ev.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, dt = Date.now() - sw.t; sw = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 1.8 * Math.abs(dy) && dt < 700) { if (dx < 0) { if (cur()) next(); } else if (!$('backBtn').disabled) back(); }
  }, { passive: true });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { tick(); lockOn(); } });
  window.addEventListener('storage', function (e) {
    if (e.key === LOGKEY) { buildHistory(); renderHistory(); }
    if (e.key === MOBKEY) { renderToday(); renderHistory(); }
  });

  /* ---------- language ---------- */
  // the "TR | EN" control sits in each tab's title row and in the workout header; a switch re-renders in place
  function fillSlots() { document.querySelectorAll('.langslot').forEach(function (el) { el.innerHTML = I18N.switchHtml(); }); }
  I18N.on(function () {
    pickVoice(); fillSlots(); setSound(soundOn);
    renderToday(); renderProgram(); renderRules(); renderHistory();
    if (ROOT.open) renderWk(); // the card (fl-exercise) re-renders itself; the step, sets and timers stay as they are
  });

  /* ---------- start ---------- */
  I18N.apply(); fillSlots();
  load(); save(); buildHistory();
  renderToday(); renderProgram(); renderRules(); route();
  if (window.FIT_onBlockChange) FIT_onBlockChange(function () {
    S().rest = null; renderProgram(); renderRules(); renderToday(); if (ROOT.open) { cardKey = ''; renderWk(); }
  });
  if (ROOT.open) openWk(ROOT.session); // the workout survives reload or app kill
  setInterval(tick, 500);

  // ask the browser not to clear the log under storage pressure
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if ('serviceWorker' in navigator) { // needs HTTPS or localhost
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
