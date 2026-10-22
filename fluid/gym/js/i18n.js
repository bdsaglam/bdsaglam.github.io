/* i18n.js: the TR | EN language switch. Load it right after exercise-data.js and before every other script.
 * Turkish is the source everywhere; this file is the one place that holds English. It defines:
 *
 *   FIT_I18N   the UI side
 *     .lang ('tr' | 'en'), .locale ('tr-TR' | 'en-GB'), .setLang(l), .on(fn) -> off()   (fn runs on a switch)
 *     .t(key, ...args)     UI string from UI below; a value is [tr, en], each a string with {0} {1} slots or a function
 *     .day(iso | Date, {dow, short})   "22 Ekim Perşembe" / "Thursday 22 October" (Intl)
 *     .weekday(n)          weekday name for getDay() n;  .num(n)  2 decimals max, locale separator (12,5 / 12.5)
 *     .lower(s), .upper(s), .cap(s)    case changes in the active locale
 *     .switchHtml()        the "TR | EN" segmented control; any [data-lang] button switches
 *     .apply(root)         fills elements marked data-i18n (innerHTML) and data-i18n-aria (aria-label) in index.html.
 *                          The Turkish markup stays in index.html and is read back from there on a switch to TR.
 *   FIT_tx     the data side: Turkish entries from exercise-data.js with English laid over them when lang is 'en'
 *     .ex(slug | entry)    entry copy: name, sub, dose, rest, rir, rirTag, cues, avoid, alt, note, video.note, anim labels
 *     .step(step, key), .steps(key, block)   resolved steps (FIT_sessionSteps) with name, detail, dose, items[].dose/.tip,
 *                          plus repsText for display (st.reps stays Turkish: the app parses it)
 *     .meta(key), .block(b), .muscle(trName), .joint(tr), .tissue(tr), .photoNote(slug, tr), .phrase(s)
 *     .missing()           list of Turkish strings without English (the test suite fails on any)
 *   FIT_EN     the English overlay itself:
 *     exercises[slug] = {name, sub, cues: [...], avoid, alt, note, vnote}   (sub '' hides a Turkish sub that is already English)
 *     sessions[key][stepId] = {name, detail, variants: {2: {detail}}}; meta[key] = {label, title, note}
 *     phrases   short repeated strings: doses, rests, reps, effort lines, routine tips, animation labels
 *     muscles   body map names, keyed by the Turkish `tr`;  joints, tissue  the same for an entry's joints / tissue
 *     photoNotes[slug]  for data/media.json
 *     html[key] English markup for the data-i18n elements of index.html
 * Any English string that is missing falls back to the Turkish one.
 * Proper names stay as they are in both languages: the gym, Etimesgut Belediyesi, YouTube channels and video titles.
 * Ağırsağlam's words stay in Turkish quotes, with the English meaning in parentheses after them.
 */
(() => {
  const LS = 'fit-lang';
  const get = () => { try { return localStorage.getItem(LS); } catch { return null; } };
  const saved = get();
  let lang = saved === 'tr' || saved === 'en' ? saved : 'en'; // English until the user picks; a saved choice wins
  const LOC = { tr: 'tr-TR', en: 'en-GB' };
  const fill = (s, a) => String(s).replace(/\{(\d)\}/g, (_, i) => (a[i] == null ? '' : a[i]));

  /* ---------- UI strings: [Turkish, English] ---------- */
  const pl = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const UI = {
    // shared units
    'u.min': [' dk', ' min'], 'u.s': [' sn', ' s'], 'u.side': [' / taraf', ' / side'], 'u.reps': [' tekrar', ' reps'],
    'u.sec': ['saniye', 'seconds'], 'u.rep': ['tekrar', 'reps'], 'u.perSide': ['/ taraf', '/ side'],
    'sets': [(n) => n + ' set', (n) => pl(n, 'set', 'sets')],
    'wk': ['hf', 'wk'],
    'week': ['{0}. hafta', 'week {0}'], 'Week': ['{0}. hafta', 'Week {0}'],
    'weekDone': ['{0}. hafta: 12 hafta bitti', 'Week {0}: 12 weeks done'],
    'block': ['Blok {0}', 'Block {0}'],
    // sessions
    'ses.sali': ['Gün A', 'Day A'], 'ses.cuma': ['Gün B', 'Day B'], 'ses.sabah': ['Sabah mobilite', 'Morning mobility'], 'ses.aksam': ['Akşam esneme', 'Evening stretch'],
    'mob.week': ['Bu hafta: ', 'This week: '],
    'lang.group': ['Dil', 'Language'],
    // sound
    'snd.off': ['Sesi kapat', 'Mute'], 'snd.on': ['Sesi aç', 'Unmute'],
    // workout: sides, cues, buttons
    'side.r': ['Sağ taraf', 'Right side'], 'side.l': ['Sol taraf', 'Left side'],
    'cues': ['Püf noktaları', 'Form tips'], 'cue.do': ['Doğru:', 'Do:'], 'cue.avoid': ['Kaçın:', 'Avoid:'],
    'b.close': ['Kapat', 'Close'], 'b.pause': ['❚❚ Duraklat', '❚❚ Pause'], 'b.resume': ['▶ Devam', '▶ Resume'], 'b.start': ['▶ Başlat', '▶ Start'],
    'b.startSec': ['▶ {0} sn başlat', '▶ Start {0} s'], 'b.nextStep': ['Sonraki adım →', 'Next step →'], 'b.nextMove': ['Sonraki hareket →', 'Next move →'],
    'b.rightDone': ['Sağ taraf bitti ✓', 'Right side done ✓'], 'b.leftDone': ['Sol taraf bitti ✓', 'Left side done ✓'],
    'b.setDone': ['Set {0} bitti ✓', 'Set {0} done ✓'], 'b.nextSet': ['Sıradaki set →', 'Next set →'], 'b.finishSes': ['Seansı bitir ✓', 'Finish session ✓'],
    'b.reset': ['Sıfırla', 'Reset'], 'b.undo': ['Geri al', 'Undo'], 'b.skip': ['Atla', 'Skip'],
    'dec': ['{0} azalt', 'Decrease {0}'], 'inc': ['{0} artır', 'Increase {0}'],
    'rt.done': ['{0} bitti ✓', '{0} done ✓'], 'time': ['Süre {0}.', 'Time {0}.'], 'rt.marked': ['Bugün için işaretlendi.', 'Marked as done for today.'],
    'ses.done': ['Seans bitti', 'Session done'],
    'ses.sum': [(n, t) => n + ' set tamamladın. Toplam süre ' + t + '.', (n, t) => 'You completed ' + pl(n, 'set', 'sets') + '. Total time ' + t + '.'],
    'ses.saved': ['Kaydedildi.', 'Saved.'],
    'c.over': ['Süre doldu, bırakabilirsin', 'Time’s up, you can stop'], 'c.run': ['Sürüyor', 'Running'], 'c.paused': ['Duraklatıldı', 'Paused'],
    'c.target': ['Hedef {0}–{1} dk', 'Target {0}–{1} min'], 'c.minus': ['1 dk azalt', '1 min less'], 'c.plus': ['1 dk artır', '1 min more'],
    'k.dyn': ['Yavaş ve kontrollü; tutup bekleme.', 'Slow and controlled; no holding.'],
    'k.stat': ['Hafif gerginlikte tut, nefes rahat.', 'Hold at a light stretch, breathe easy.'],
    'opt': ['İsteğe bağlı: vaktin yoksa geç. ', 'Optional: skip it if you are short on time. '],
    'both': ['İki taraf: önce sol, sonra sağ. ', 'Both sides: left first, then right. '],
    'lr': [' · önce sol, sonra sağ', ' · left first, then right'],
    'switch': ['Taraf değiştir', 'Switch sides'], 'ready': ['Hazırlan', 'Get ready'],
    'eachSide': [' · her taraf için tekrarla', ' · repeat on each side'], 'pausedL': [' · duraklatıldı', ' · paused'],
    'lrSide': ['Önce sol, sonra sağ taraf. ', 'Left side first, then right. '], 'slow': ['Yavaş ve kontrollü yap.', 'Go slow and controlled.'],
    'rest': ['Dinlenme: {0}', 'Rest: {0}'], 'last': ['Geçen sefer: {0}', 'Last time: {0}'], 'last.none': ['Geçen sefer: kayıt yok', 'Last time: no record'],
    'up': ['Ağırlığı artır ↑', 'Add weight ↑'], 'warmSets': ['Isınma setleri', 'Warm-up sets'], 'warmN': ['Isınma {0}', 'Warm-up {0}'],
    'workSets': ['Çalışma setleri', 'Work sets'], 'leftOk': ['sol ✓', 'left ✓'], 'nextS': ['sıradaki', 'next'],
    'set.saved': ['Set {0} kayıtlı; değeri düzeltebilirsin.', 'Set {0} saved; you can still edit it.'],
    'set.side': [': önce sol, sonra sağ; dinlenme iki taraf bitince başlar.', ': left first, then right; rest starts after both sides.'],
    'form': ['Formum iyiydi', 'Good form'],
    'daily': ['~{0} dk · her gün', '~{0} min · daily'],
    'r.rest': ['Dinlen', 'Rest'], 'r.over': ['Hazırsan başla (en geç {0})', 'Start when ready ({0} at most)'], 'r.ready': ['Dinlenme bitti, sıradaki sete!', 'Rest over, on to the next set!'],
    // Bugün
    'noStart': ['Başlangıç tarihi yok', 'No start date'], 'starts': ['Program {0} başlıyor', 'Program starts {0}'],
    'manual': [' · blok elle seçildi', ' · block picked by hand'], 'change': ['Değiştir', 'Change'],
    'cont': ['Devam et ({0}/{1})', 'Continue ({0}/{1})'], 'contShort': ['Devam et', 'Continue'], 'openSes': ['Seansı aç', 'Open session'],
    'doneToday': ['Bugün tamamlandı ✓', 'Done today ✓'], 'mob': ['Günlük esneme', 'Daily stretching'], 'everyDay': ['her gün', 'daily'],
    'mob.done': ['Bugün yapıldı ✓', 'Done today ✓'], 'dyn': ['dinamik', 'dynamic'], 'stat': ['statik', 'static'],
    'lastWo': ['Son antrenman: {0}', 'Last workout: {0}'], 'running': ['Devam eden seans', 'Session in progress'],
    'today': ['Bugün: {0}', 'Today: {0}'], 'startWo': ['Antrenmanı başlat', 'Start workout'],
    'z2': ['Zone 2 kardiyo', 'Zone 2 cardio'], 'z2.pace': ['Konuşabildiğin tempo', 'A pace you can talk at'], 'z2.min': ['30-40 dk', '30-40 min'],
    'z2.str': ['Esneme: yukarıdaki akşam rutini.', 'Stretching: the evening routine above.'],
    'restDay': ['Bugün dinlenme', 'Rest day'], 'nextDay': ['Sıradaki: {0}, {1}', 'Next: {0}, {1}'],
    'tomorrow': ['yarın', 'tomorrow'], 'inDays': ['{0} gün sonra', 'in {0} days'], 'anyway': ['Yine de başlat', 'Start anyway'],
    // Program
    'g.when': ['Her gün · sabah ~{0} dk, akşam ~{1} dk', 'Every day · morning ~{0} min, evening ~{1} min'],
    'g.p': ['Antrenmana ek, masa başı için. Sabah dinamik: yavaş hareket, tutup beklemek yok. Akşam statik: her taraf 30 sn, ağrı değil hafif gerginlik. Başlatınca zamanlayıcı her hareketi ve tarafı sırayla yürütür.',
      'On top of training, for desk days. Morning is dynamic: slow movement, no holding. Evening is static: 30 s per side, a light stretch, not pain. Once started, the timer runs each move and side in turn.'],
    'g.todayOk': [' · bugün ✓', ' · today ✓'], 'g.start': ['{0} başlat', 'Start {0}'],
    'g.src': ['Kaynak: ACSM (statik esnemede 10-30 sn, her gün en etkili) ve Ağırsağlam (önce dinamik, sonra statik). Ayrıntı Kurallar sekmesinde.',
      'Sources: ACSM (static stretches: 10-30 s is enough, daily works best) and Ağırsağlam (dynamic before, static after). Details in the Rules tab.'],
    'w.h': ['Isınma &amp; Soğuma', 'Warm-up &amp; cool-down'], 'w.when': ['Her seans', 'Every session'],
    'w.p': ['Gün A ve Gün B için ortak rutin. Başta dinamik, sonda statik esneme; seansa ~20 dk ekler. Uzun statik esneme ağırlıktan hemen önce kuvveti biraz düşürebilir. Soğuma esnetmelerinin bir kısmı {0} kısa videosundan (The ONLY Stretches you need!).',
      'One routine for both Day A and Day B. Dynamic stretches at the start, static ones at the end; it adds ~20 min to the session. Long static stretching right before lifting can lower strength a little. Some of the cool-down stretches come from a {0} short (The ONLY Stretches you need!).'],
    'w.start': ['Başlangıç', 'Warm-up'], 'w.sets': ['Her ana hareketten önce ısınma setleri yap; sayısı ve ağırlığı seansa göre ayarla.', 'Do warm-up sets before each main lift; set their number and weight for the session.'],
    'w.cool': ['Soğuma', 'Cool-down'], 'w.coolp': ['Nefes rahat, ağrı değil hafif gerginlik. Zıplama yok.', 'Breathe easy; a light stretch, not pain. No bouncing.'],
    's.p': ['Çizimler şematiktir. İlk setleri hafif tut, hareketi öğren; ana hareketlerden önce 1-2 ısınma seti yap.',
      'The drawings are schematic. Keep the first sets light and learn the movement; do 1-2 warm-up sets before the main lifts.'],
    's.ex': ['Hareketler', 'Exercises'], 's.start': ['{0} antrenmanını başlat', 'Start {0}'],
    // Kurallar
    'k.now': ['şu an Blok {0}', 'now Block {0}'], 'k.new': ['yeni', 'new'],
    'k.key': ['<b>Kalın</b>: blokla değişen · soluk: 12 hafta sabit', '<b>Bold</b>: changes with the block · faded: same for 12 weeks'],
    // fl-exercise
    'x.photo': ['Fotoğraf', 'Photo'], 'x.video': ['Video', 'Video'], 'x.anim': ['Animasyon', 'Animation'],
    'x.rirTip': ['RIR: Reps in Reserve — setin sonunda yedekte kalan tekrar sayısı', 'RIR: Reps in Reserve, the reps you still have left at the end of a set'],
    'x.offline': ['Video için internet bağlantısı gerekli. Fotoğraf ve Animasyon çevrimdışı çalışır.', 'The video needs an internet connection. Photo and Animation work offline.'],
    'x.noEmbed': ['Bu video gömülemiyor; aşağıdaki "YouTube\'da aç" bağlantısını kullan.', 'This video can’t be embedded; use the "Open on YouTube" link below.'],
    'x.vidTitle': ['{0} videosu', '{0} video'], 'x.pause': ['❚❚ Duraklat', '❚❚ Pause'], 'x.play': ['▶ Oynat', '▶ Play'],
    'x.noData': ['fl-exercise: /components/exercise-data.js yüklenmedi', 'fl-exercise: /components/exercise-data.js is not loaded'],
    'x.notFound': ['fl-exercise: "{0}" bulunamadı', 'fl-exercise: "{0}" not found'],
    'x.yt': ['▶ YouTube\'da aç', '▶ Open on YouTube'], 'x.page': ['Ağırsağlam yazısı', 'Ağırsağlam article'],
    'x.animLabel': ['{0} hareket animasyonu', '{0} movement animation'], 'x.speed': ['Hız', 'Speed'],
    'x.alt0': ['{0} başlangıç pozisyonu', '{0} start position'], 'x.alt1': ['{0} bitiş pozisyonu', '{0} end position'],
    'x.noImg': ['Görsel yok.', 'No image.'], 'x.rest': ['Dinlenme {0}', 'Rest {0}'],
    'x.blkTip': ['Bu hareket bloğa göre değişir', 'This exercise changes with the block'], 'x.effort': ['Efor', 'Effort'],
    'x.do': ['Doğru', 'Do'], 'x.avoid': ['Kaçın', 'Avoid'], 'x.alt': ['Alternatif:', 'Alternative:'], 'x.vnote': ['Video: {0}', 'Video: {0}'],
    // fl-session-timeline
    'tl.missing': ['fl-session-timeline: "{0}" yok (exercise-data.js yüklendi mi?)', 'fl-session-timeline: no "{0}" (is exercise-data.js loaded?)'],
    'tl.longest': ['en uzun senaryo ~{0} dk', 'longest case ~{0} min'],
    'tl.over': ['Toplam ~{0} dk: {1} dk sınırını {2} dk aşıyor.', 'Total ~{0} min: {2} min over the {1} min limit.'],
    'tl.overHi': ['Toplam ~{0} dk; en uzun senaryoda ~{1} dk, {2} dk sınırını aşabilir.', 'Total ~{0} min; ~{1} min in the longest case, which can pass the {2} min limit.'],
    'tl.ok': ['Toplam ~{0} dk{1}: {2} dk sınırı içinde.', 'Total ~{0} min{1}: within the {2} min limit.'],
    'tl.head': ['Seans programı — {0}', 'Session plan — {0}'], 'tl.minAt': ['{0}. dk', 'min {0}'], 'tl.out': ['çıkış', 'finish'],
    'tl.total': ['Toplam', 'Total'], 'tl.totalMin': ['Toplam ~{0} dk', 'Total ~{0} min'], 'tl.incl': ['ısınma ve soğuma dahil', 'incl. warm-up and cool-down'],
    // fl-block-picker
    'bp.noData': ['fl-block-picker: /components/exercise-data.js yüklenmedi', 'fl-block-picker: /components/exercise-data.js is not loaded'],
    'bp.starts': ['program {0} başlıyor', 'program starts {0}'], 'bp.manual': ['Elle seçildi', 'Picked by hand'], 'bp.byDate': [' · tarihe göre ', ' · by date: '],
    'bp.auto': ['Tarihe göre seç', 'Follow the date'], 'bp.url': ['Bağlantıdan seçildi', 'Picked from the link'], 'bp.since': ['başlangıç {0}', 'started {0}'],
    'bp.none': ['Başlangıç tarihi yok; ilk kayıttan sonraki salı başlangıç sayılır', 'No start date; the first Tuesday after your first record counts as the start'],
    'bp.aria': ['Program bloğu', 'Program block'], 'bp.start': ['Başlangıç', 'Start'], 'bp.startAria': ['Program başlangıç tarihi', 'Program start date'],
    // body map
    'bm.front': ['ÖN', 'FRONT'], 'bm.back': ['ARKA', 'BACK'], 'bm.str': ['Esneyen kaslar', 'Muscles stretched'], 'bm.work': ['Çalışan kaslar', 'Muscles worked'],
    'bm.joints': ['Eklemler', 'Joints'], 'bm.tissue': ['Bağ dokusu', 'Connective tissue'],
    'bm.key': ['koyu: ana kas · açık: yardımcı', 'dark: main · light: helper'], 'bm.off': [' · halka: haritada yok', ' · ring: not on the map'],
  };

  /* ---------- English overlay of the program data ---------- */
  const ANIM_NOTE = 'Animations are in the "Warm-up & cool-down" view.';
  const EN = {
    exercises: {
      'goblet-squat': { name: 'Goblet Squat', sub: 'Squat with a dumbbell held at the chest',
        cues: ['Hold the dumbbell tight to your chest, elbows down', 'Push the hips back and down; thighs at least parallel to the floor', 'Heels down, knees in line with the toes, torso upright'],
        avoid: 'Knees caving in, heels lifting', alt: 'Leg press.', vnote: 'no separate goblet squat video; he recommends the goblet squat at 2:49-4:37' },
      'db-bench-press': { name: 'Dumbbell Bench Press', sub: 'Flat bench',
        cues: ['Lower the dumbbells to chest level; elbows ~45° from the body (they look short from the side)', 'Squeeze the shoulder blades back and down into the bench', 'Feet on the floor; press the dumbbells up over the shoulders'],
        avoid: 'Flaring the elbows out to 90°, arching the lower back too much', alt: 'Barbell bench press or push-ups.', vnote: 'short video' },
      'one-arm-db-row': { name: 'One-Arm Dumbbell Row', sub: 'One hand and knee on the bench',
        cues: ['One hand and the same-side knee on the bench; back flat, about parallel to the floor.', 'Pull the elbow back towards the hip; squeeze the shoulder blade.', 'Lower the dumbbell under control over 2 s; don’t twist the torso.'],
        avoid: 'Twisting or swinging the torso to lift; shrugging the shoulder to the ear.', alt: 'Seated cable row.', vnote: 'one-arm dumbbell row recommendation at 21:14' },
      'db-rdl': { name: 'Dumbbell Romanian Deadlift', sub: 'Hip hinge, dumbbells close to the legs',
        cues: ['Knees slightly bent and fixed; push the hips back', 'Back flat, neck neutral; the dumbbells slide close to the legs', 'Stop just below the knees / mid-shin, then drive the hips forward to stand up'],
        avoid: 'Rounding the back, bending the knees like a squat', vnote: 'dumbbell deadlift; no separate RDL video. Hip hinge drill: PB25g5ViNN4' },
      'plank': { name: 'Plank', sub: 'Forearm plank, static hold',
        cues: ['Elbows right under the shoulders', 'Straight line from head to heels; squeeze glutes and abs', 'Breathe normally, don’t hold your breath', 'Past 60 s, make it harder (move the elbows forward)'],
        avoid: 'Hips sagging (lower back dropping) or piking up' },
      'barbell-deadlift': { name: 'Barbell Deadlift', sub: 'Conventional',
        cues: ['First 2–3 light warm-up sets, then 1 work set.', 'Bar over mid-foot; hips above the knees, below the shoulders.', 'Back neutral, chest open; drag the bar up along your legs.', 'Lock the hips at the top and stand tall; don’t lean back.'],
        avoid: 'Rounding the lower back; the bar drifting away from the legs.', alt: 'Dumbbell deadlift.',
        note: 'Ağırsağlam: the deadlift is very taxing on the nervous system, so 1 work set is enough.' },
      'lat-pulldown': { name: 'Lat Pulldown',
        cues: ['Lean back slightly and open your chest towards the bar.', 'Drive the elbows down and back; bring the bar to the upper chest.', 'Let the bar up slowly; arms fully straight, shoulders away from the ears.'],
        avoid: 'Swinging the torso or pulling the bar behind the neck.', alt: 'Assisted pull-up machine.' },
      'barbell-ohp': { name: 'Barbell Overhead Press', sub: 'Standing',
        cues: ['Bar in front of the shoulders, forearms vertical; elbows slightly in front of the bar.', 'Press the bar straight up; tilt your head back a little as it passes your face, then bring your head under the bar.', 'Ribs down, glutes and abs tight; lock out with the bar over mid-foot.'],
        avoid: 'Leaning back and arching the lower back; pressing the bar forward.', alt: 'Shoulder press machine or dumbbells.',
        note: 'Ağırsağlam recommends starting with a barbell: "doğrudan dambılla başlamayı uygun bulmuyorum" (I don’t think starting straight with dumbbells is a good idea).',
        vnote: 'why to start with a barbell instead of dumbbells: 11:50-12:13' },
      'leg-press': { name: 'Leg Press',
        cues: ['Back and hips fixed on the pad; the lower back stays on the pad.', 'Knees bend to ~90°, in line with the toes.', 'Don’t lock the knees at the top; keep them slightly bent.'],
        avoid: 'Going so deep that the hips leave the pad (the lower back rounds); knees caving in.', alt: 'Dumbbell split squat.', vnote: 'short video' },
      'face-pull': { name: 'Face Pull', sub: 'Cable, rope attachment',
        cues: ['Pulley at face height; pull the rope towards your forehead / eyes.', 'Elbows high: at the end at shoulder height or slightly behind.', 'Hands finish beside the ears (external rotation); shoulders back and down.'],
        avoid: 'Going heavy and swinging the torso back; keep it light.', alt: 'Band pull-apart.' },
      'seated-leg-curl': { name: 'Seated Leg Curl', sub: 'Machine, hamstrings',
        cues: ['Knees in line with the machine’s pivot; the thigh pad sits firmly just above the knees.', 'Pull the heels down and back; squeeze briefly at the bottom.', 'Straighten the legs under control over 2 s; don’t let the stack slam.'],
        avoid: 'Lifting the hips off the seat, swinging the weight.',
        alt: 'No machine: lying leg curl; if there’s none either, stability ball hamstring curl (lying on your back, heels on the ball).',
        note: 'Study: the seated leg curl builds more muscle than the lying one (Maeo et al., 2021).', vnote: 'short video' },
      'lying-leg-curl': { name: 'Lying Leg Curl', sub: 'Machine, face down',
        cues: ['Kneecaps just off the bench; pad a little above the heels.', 'Press the hips into the bench and curl the heels towards your glutes.', 'Lower the legs under control over 2 s.'],
        avoid: 'Lifting the hips off the bench, arching the lower back.', alt: 'Seated leg curl; no machine: stability ball hamstring curl.', vnote: 'lying leg curl machine, 54 s' },
      'push-up': { name: 'Push-up', sub: '',
        cues: ['Hands slightly wider than shoulder width, under the shoulders.', 'Straight line from head to heels; abs and glutes tight.', 'Lower until your chest is close to the floor; elbows ~45° from the body.'],
        avoid: 'Hips sagging; flaring the elbows out to 90°.', alt: 'Too hard: incline push-ups with hands on a bench; once easy, raise the feet.',
        vnote: 'push-ups for beginners. Easy to hard variations: 8eYrT_0nQKw' },
      'seated-cable-row': { name: 'Seated Cable Row', sub: 'Cable, V-handle',
        cues: ['Knees slightly bent, torso upright, chest open.', 'Pull the handle to your belly; elbows close to the body, squeeze the shoulder blades.', 'Extend the arms over 2 s; don’t round the lower back.'],
        avoid: 'Rocking the torso back and forth to pull.', alt: 'No cable: one-arm dumbbell row or chest-supported dumbbell row.' },
      'chest-supported-db-row': { name: 'Chest-Supported Dumbbell Row', sub: 'Incline bench, chest on the pad',
        cues: ['Bench at 30-45°; chest on the pad, feet on the floor.', 'Drive the elbows back to pull the dumbbells to your ribs; squeeze the shoulder blades.', 'Lower under control over 2 s; arms fully straight.'],
        avoid: 'Lifting the chest off the pad, cranking the head up.', alt: 'No incline bench: one-arm dumbbell row; a chest-supported row machine (T-bar) also works.',
        vnote: 'no separate video; at 21:35 he recommends the dumbbell row on an incline bench' },
      'side-plank': { name: 'Side Plank', sub: 'On the forearm, static hold',
        cues: ['Elbow right under the shoulder; feet stacked.', 'Lift the hips: a straight line from head to feet.', 'Breathe normally; when time is up, switch sides.'],
        avoid: 'Hips sagging or drifting back.', alt: 'Too hard: side plank with bent knees.', note: 'Front view: the forearm points towards you, the top hand is on the hip.', vnote: 'side plank 9:01-9:30' },
      'weighted-plank': { name: 'Weighted Plank', sub: 'Plate on the back',
        cues: ['Have someone place the plate on your back, between the shoulder blades.', 'Same as the plank: elbows under the shoulders, straight line from head to heels.', 'Start light (5-10 kg); once 45 s feels easy, add weight.'],
        avoid: 'Putting the plate on the lower back; hips sagging.', alt: 'No plate: plank with the elbows a bit further forward (a harder lever).',
        vnote: 'plank at 5:55: "ağırlıklı veya vücut ağırlığıyla" (weighted or bodyweight)' },
      'supinated-pulldown': { name: 'Underhand Lat Pulldown', sub: 'Palms facing you, shoulder-width',
        cues: ['Palms facing you, hands shoulder-width apart.', 'Pull the bar to the upper chest; elbows come down close to the body.', 'Let the bar up slowly; arms fully straight.'],
        avoid: 'Leaning far back and swinging.', alt: 'No machine: assisted pull-up (underhand) or band-assisted pull-up.',
        note: 'The side view can’t show the grip; the movement is the same as the lat pulldown.', vnote: 'underhand pulldown program at 19:36 (3 × 6-8)' },
      'assisted-pullup': { name: 'Assisted Pull-up', sub: 'Machine, knees on the pad',
        cues: ['Knees on the pad; grip shoulder-width.', 'Pull your chest towards the bar; chin goes over the bar.', 'Lower slowly, arms fully straight.'],
        avoid: 'Jumping up with the legs, half reps.', alt: 'No machine: band-assisted pull-up; if there’s none either, lat pulldown.',
        note: 'More assistance weight makes it easier. Reduce the assistance as you progress.', vnote: 'band-assisted pull-up at 3:34; no machine video' },
      'db-split-squat': { name: 'Dumbbell Split Squat', sub: 'Fixed split stance, a dumbbell in each hand',
        cues: ['Long split stance: back heel up, feet hip-width apart.', 'Lower the back knee towards the floor; the whole front foot stays flat.', 'Torso upright; push through the front heel to stand. One leg first, then the other.'],
        avoid: 'Front knee caving in; front heel lifting.', alt: 'No dumbbells: bodyweight; the leg press also works.' },
      'reverse-fly': { name: 'Reverse Fly', sub: 'Machine (reverse pec deck)',
        cues: ['Chest against the pad, handles at shoulder height.', 'Arms slightly bent; open back in a wide arc.', 'Keep it light, return over 2 s.'],
        avoid: 'Going heavy and swinging with the torso; shrugging the shoulders to the ears.', alt: 'No machine: band pull-apart or bent-over dumbbell reverse fly.',
        note: 'Side view: the arms look short as they open out to the sides.', vnote: 'short video' },
      'bike': { name: 'Light cardio', sub: 'Treadmill or stationary bike', cues: ['Treadmill or stationary bike.', 'A pace you can talk at, light sweat.'] },
      'leg-swing': { name: 'Leg swings', sub: 'Front to back', cues: ['Hold on to a wall, torso upright; swing from the hip.', 'Start small, then swing wider.'],
        vnote: 'hip and leg mobility video; the leg swing segment is not verified' },
      'worlds-greatest-stretch': { name: 'World’s Greatest Stretch', sub: 'Hip opener', cues: ['Step forward, hands on the floor, elbow towards the inside of the foot.', 'Open the same-side arm to the ceiling and follow your hand with your eyes.'],
        vnote: 'dynamic warm-up routine; this move’s segment is not verified' },
      'arm-circles': { name: 'Arm circles', sub: 'Forwards and backwards', cues: ['Start with small circles and slowly make them bigger.', 'Keep the shoulders away from the ears, torso still.'],
        vnote: 'shoulder mobility video; segment not verified' },
      'stick-pass-through': { name: 'Stick pass-through', note: 'Side view: the stick is seen end-on (dark dot); the dashed line shows its path.',
        cues: ['Start with a wide grip, arms straight; take the stick from the front, over your head, to the back.', 'A narrow grip is harder; if the shoulders strain, widen the grip.'],
        vnote: 'short shared by the user, the move at 0:22' },
      'bodyweight-squat': { name: 'Bodyweight squat', cues: ['Lower slowly and go deep; heels down, chest up.', 'Knees in line with the toes.'], vnote: 'squat basics' },
      'cat-cow': { name: 'Cat-cow', sub: '', cues: ['Round your back as you breathe out, arch it as you breathe in.', 'Go slowly; let the movement flow along the spine.'], vnote: 'cat-cow segment at about 2:19' },
      'pancake-stretch': { name: 'Pancake stretch', sub: 'Seated straddle', note: 'Side view; in reality the legs are spread wide.',
        cues: ['Fold from the hips, keep the back flat.', 'At first, rest your hands on a step or a bench; higher is easier, lower is harder.'], vnote: 'short shared by the user, the move at 0:04' },
      'figure-4-stretch': { name: 'Figure-4 stretch', sub: 'Lying on your back, hips', note: 'Feels good after squats and deadlifts. The video also shows a seated version.',
        cues: ['Lie on your back, ankle over the opposite knee; pull the bottom thigh towards your chest.', 'If it’s hard, support the knee with your hand; as you loosen up, try to straighten the knee.'],
        vnote: 'short shared by the user, the move at 0:08' },
      'hip-flexor-reach': { name: 'Kneeling hip flexor stretch with reach',
        cues: ['Back knee on the floor, push the hips forward, torso upright.', 'Reach the arm on the back-knee side to the ceiling and lean slightly to the other side; the stretch reaches up to the belly.'],
        vnote: 'short shared by the user, the move at 0:17' },
      'lat-stretch-rail': { name: 'Lat stretch', sub: 'Bench / rack / rail', note: 'The video shows three levels from easy to hard; start with the easy one.',
        cues: ['Hold on to a bench, rack or rail; hands between hip and chest height.', 'Push the hips back and let the chest drop down between the arms.'], vnote: 'short shared by the user, the move at 0:34' },
      'quad-stretch': { name: 'Standing quad stretch', sub: '', cues: ['Pull the heel to your glutes, knees side by side.', 'Don’t arch the lower back; push the hips slightly forward.'], vnote: 'quad stretch at 3:04-3:14' },
      'chest-doorway-stretch': { name: 'Doorway chest stretch', cues: ['Forearm on the door frame, elbow at shoulder height.', 'Step forward until you feel a light stretch in the chest.'],
        vnote: 'chest stretch at 1:11-2:18; the door frame version is not verified' },
      'hamstring-stretch': { name: 'Hamstring stretch', cues: [], vnote: 'hamstring stretch at 3:24' },
      'hip-flexor-stretch': { name: 'Hip flexor stretch', cues: [], vnote: 'hip flexor stretch at 2:37' },
      'thoracic-rotation': { name: 'Quadruped thoracic rotation', sub: 'Thoracic spine (T-spine) rotation',
        alt: 'Side-lying open book: knees bent, open the top arm back in an arc.', note: 'Side view: the rotation shows as the arm’s up-and-down arc.',
        cues: ['On all fours; sit the hips back a little towards the heels, keep the lower back still.', 'Put one hand behind your head; bring the elbow down under the other arm, then open it to the ceiling.', 'Follow the elbow with your eyes; open up as you breathe out.'],
        avoid: 'Turning from the lower back or the hips; swinging fast.', vnote: 'physiotherapist; the Ağırsağlam channel has no video of this move' },
      'ankle-rock': { name: 'Knee-to-wall ankle mobilization', sub: 'Ankle mobility',
        alt: 'No wall: half-kneel and push the front knee past the toes.',
        cues: ['Front foot a hand’s width from the wall, back foot behind.', 'Keep the heel down; push the knee towards the wall over the second toe, hold 1-2 s, come back.', 'If the knee touches the wall easily, move the foot back a little.'],
        avoid: 'Heel lifting; knee caving in.' },
      'deep-squat-hold': { name: 'Deep squat hold', sub: 'Holding on to a door frame', alt: 'If your heels lift, put a thin book or a plate under them.',
        note: 'Ağırsağlam: if squatting down is hard, he recommends stretching in the squat position while holding on to something.',
        cues: ['Hold the door frame with both hands; feet shoulder-width, toes turned out slightly.', 'Sit down slowly as low as you can; heels down, push the knees out gently with your elbows.', 'Chest open, breathe easy; if it’s hard, take more support with your hands.'],
        avoid: 'Heels lifting; pushing into pain.', vnote: 'holding on while squatting down to stretch, 1:49-2:14' },
      'neck-tilt-turn': { name: 'Neck tilts and turns', sub: 'Slow, dynamic', alt: 'At your desk, chin tucks: head against a wall, gently pull the chin in, hold 5 s.',
        note: 'A move done facing forward; no drawing.',
        cues: ['Sit or stand tall, shoulders down.', 'Slowly tilt your ear towards your shoulder, back to the middle, then to the other side.', 'Then turn your head right and left; keep the chin level.'],
        avoid: 'Rolling the head back in a circle; forcing into a painful spot.', vnote: 'neck side stretch 4:04-5:40 (static); in the morning do it slowly and dynamically' },
      'calf-stretch-wall': { name: 'Wall calf stretch', sub: 'Back leg straight, heel down', alt: 'Heel drop on a step: toes on the step, slowly let the heel down.',
        cues: ['Hands on the wall, one leg stretched back; back toes point forward.', 'Press the back heel into the floor, knee straight; push the hips towards the wall.', 'Then bend the back knee slightly: the stretch moves down towards the Achilles.'],
        avoid: 'Back heel lifting; foot turning out.' },
      'childs-pose-lat-stretch': { name: 'Child’s pose with side reach', sub: 'Lat stretch on the floor', alt: 'If there’s a bench, rack or rail, a standing lat stretch.',
        note: 'Side view; the side reach is not visible.',
        cues: ['Knees hip-width apart, hips sit back on the heels; arms in front.', 'Walk both hands to the right: the left side stretches. After 30 s, walk them to the left.', 'As you breathe out, push the hips back and the hands forward.'],
        avoid: 'Lifting the hips off the heels; forcing the shoulder.' },
      'supine-breathing': { name: 'Supine breathing', sub: 'In through the nose, long exhale', alt: 'Calves on a chair (90/90), or lie face down with your forehead on your hands.',
        cues: ['Lie on your back, knees bent; one hand on the chest, one on the belly.', 'Breathe in through the nose for ~4 s: the belly rises, the chest barely moves.', 'Breathe out slowly through the mouth or nose for ~6-8 s; relax the shoulders and jaw.'],
        avoid: 'Forcing or holding the breath; quick breaths from the chest.', vnote: 'version with the calves on a chair (90/90)' },
    },
    meta: {
      sali: { label: 'Tuesday', title: 'Day A — Push & quads', note: 'Estimate: ~40 s of work per set plus rest; ~1 min to switch between exercises. Ağırsağlam finds ~40 min of lifting enough for a beginner.' },
      cuma: { label: 'Friday', title: 'Day B — Pull & posterior chain', note: 'Estimate: ~40 s of work per set plus rest; ~1 min to switch between exercises. Ağırsağlam finds ~40 min of lifting enough for a beginner.' },
      sabah: { label: 'Morning', title: 'Morning mobility', note: 'Every day, after you get up. Dynamic: no holding, slow and controlled movement. Times are per move; the timer moves on by itself.' },
      aksam: { label: 'Evening', title: 'Evening stretch', note: 'Every day, before bed. Static: 30 s per side, a light stretch, not pain; no bouncing, breathe easy.' },
    },
    blocks: { 1: 'Block 1', 2: 'Block 2', 3: 'Block 3' },
    sessions: {
      sali: {
        'kardiyo': { name: 'Cardio', detail: 'Treadmill or bike, easy pace (5-10 min)' },
        'dinamik-esneme': { name: 'Dynamic warm-up', detail: 'Leg swings, bodyweight squats, arm circles, stick pass-throughs, cat-cow, 8-10 reps; leg swings on each leg. ' + ANIM_NOTE },
        'goblet-squat': { detail: '3×8-12 · warm-up set ~2 min + 2×2-3 min rest + 1 min to switch' },
        'db-bench-press': { detail: '3×8-12 · warm-up set ~2 min + 2×2-3 min rest + 1 min to switch' },
        'one-arm-db-row': { detail: '3×8-12/arm · both arms ~80 s per set + 2×60-90 s rest + 1 min to switch',
          variants: { 2: { detail: '3×8-12 · 2×60-90 s rest + 1 min to switch' }, 3: { detail: '3×8-12 · 2×60-90 s rest + 1 min to switch' } } },
        'db-rdl': { detail: '3×8-12 · 2×2 min rest + 1 min to switch' },
        'plank': { detail: '3×30-60 s · 2×60 s rest + 1 min to switch',
          variants: { 2: { detail: '3×20-40 s/side · both sides ~70 s + 2×60 s rest + 1 min to switch' }, 3: { detail: '3×30-45 s, plate on your back · 2×60 s rest + 1 min to switch' } } },
        'soguma': { name: 'Cool-down', detail: 'Pancake 30 s; figure-4, hip flexor + reach, quad, chest: left first, then right, 30 s per side. ' + ANIM_NOTE },
      },
      cuma: {
        'kardiyo': { name: 'Cardio', detail: 'Treadmill or bike · 5 min (10 if you have time)' },
        'dinamik-esneme': { name: 'Dynamic warm-up', detail: 'Leg swings, World’s Greatest Stretch, arm circles, stick pass-throughs, cat-cow, 8-10 reps; leg swings and World’s Greatest Stretch on each side. ' + ANIM_NOTE },
        'barbell-deadlift': { detail: '2-3 warm-up sets (~4-5 min) + 1×5 work set + 1 min to switch' },
        'lat-pulldown': { detail: '3×6-10 · ~1 min warm-up + 2×2 min rest + 1 min to switch' },
        'barbell-ohp': { detail: '3×6-10 · warm-up set ~2 min + 2×2-3 min rest + 1 min to switch' },
        'leg-press': { detail: '3×8-12 · 2×2 min rest + 1 min to switch',
          variants: { 2: { detail: '3×8-12/leg · both legs ~80 s per set + 2×60-90 s rest + 1 min to switch' } } },
        'seated-leg-curl': { detail: '2×8-12 (3 if you have time) · 60-90 s rest + 1 min to switch' },
        'push-up': { detail: '2 sets, stop 2 reps before failure · 60 s rest + 1 min to switch' },
        'face-pull': { detail: '3×15-20, light · 2×60 s rest + 1 min to switch' },
        'plank': { detail: '2×30-60 s · 60 s rest + 1 min to switch',
          variants: { 2: { detail: '2×20-40 s/side · both sides ~70 s + 1×60 s rest + 1 min to switch' }, 3: { detail: '2×30-45 s, plate on your back · 1×60 s rest + 1 min to switch' } } },
        'soguma': { name: 'Cool-down', detail: 'Pancake and lat 30 s; figure-4, hip flexor + reach, quad: left first, then right, 30 s per side. ' + ANIM_NOTE },
      },
      sabah: {}, aksam: {}, // routine steps: names come from the exercises, doses and tips from phrases
    },
    phrases: {
      // doses, rests, reps
      '3 × 8–12 / kol': '3 × 8–12 / arm', '3 × 8–12 / bacak': '3 × 8–12 / leg', '3 × 30–60 sn': '3 × 30–60 s', '2 × 30–60 sn': '2 × 30–60 s',
      '1 × 5 çalışma seti': '1 × 5 work set', '3 × 15–20 (hafif)': '3 × 15–20 (light)', '2 × tükenişe 2 kala': '2 × 2 short of failure',
      '2–3 × 20–40 sn / taraf': '2–3 × 20–40 s / side', '2–3 × 30–45 sn': '2–3 × 30–45 s', '3 × 20–40 sn / taraf': '3 × 20–40 s / side',
      '2 × 20–40 sn / taraf': '2 × 20–40 s / side', '3 × 30–45 sn': '3 × 30–45 s', '2 × 30–45 sn': '2 × 30–45 s',
      '5–10 dk': '5–10 min', '8–10 tekrar/taraf': '8–10 reps/side', '8–10 tekrar/yön': '8–10 reps/direction', '8–10 tekrar': '8–10 reps',
      '30 sn': '30 s', '30 sn/taraf': '30 s/side', '6 tekrar/taraf': '6 reps/side', '10 tekrar/taraf': '10 reps/side', '30–45 sn': '30–45 s',
      '5 tekrar/yön': '5 reps/direction', '1 dk': '1 min', '8 yavaş tekrar': '8 slow reps', '4 tekrar/taraf': '4 reps/side',
      '10 tekrar/yön': '10 reps/direction', '10 tekrar': '10 reps',
      '2–3 dk': '2–3 min', '60–90 sn': '60–90 s', '2 dk': '2 min', '60 sn': '60 s', 'ısınma setleri arası ~1 dk': '~1 min between warm-up sets',
      '8–12 / kol': '8–12 / arm', '8–12 / bacak': '8–12 / leg', 'tükenişe 2 kala': '2 short of failure',
      // routine tips and markers
      'sopa yoksa havlu': 'a towel if you have no stick', 'isteğe bağlı': 'optional',
      // effort
      'Form bozulmadan 2 tekrar kala bırak': 'Stop 2 reps before failure, with good form', '1-2 tekrar kala bırak': 'Stop 1-2 reps before failure',
      '1-2 tekrar kala bırak; son sette 0-1 tekrar kalabilir': 'Stop 1-2 reps before failure; on the last set 0-1 in reserve is fine',
      'Formu bozulmadan bitir': 'Finish without losing form', 'Hafif tut; son sette 0-1 tekrar kalabilir': 'Keep it light; on the last set 0-1 in reserve is fine',
      'Tükenişe 2 tekrar kala bırak': 'Stop 2 reps before failure', 'RIR 1-2 · son set 0-1': 'RIR 1-2 · last set 0-1', 'son set RIR 0-1': 'last set RIR 0-1',
      // animation phase and guide labels
      'İniş · 2 sn': 'Lower · 2 s', 'Altta bekle': 'Pause at the bottom', 'Kalk · 1 sn': 'Stand up · 1 s', 'Üstte bekle': 'Pause at the top',
      'İt · 1 sn': 'Press · 1 s', 'Çek · 1 sn': 'Pull · 1 s', 'Sık, bekle': 'Squeeze, pause', 'İndir · 2 sn': 'Lower · 2 s', 'Aşağıda bekle': 'Pause at the bottom',
      'Kalçayı öne sür · 1 sn': 'Drive the hips forward · 1 s', 'Tut · nefes al': 'Hold · breathe', 'Zemini it, barı bacağa sürt · 1 sn': 'Push the floor, bar along the legs · 1 s',
      'Kısa duraklama': 'Short pause', 'Kontrollü indir · 2 sn': 'Lower with control · 2 s', 'Hazırlan': 'Get ready', 'Barı çek · 1 sn': 'Pull the bar · 1 s',
      'Barı kontrolle bırak · 2 sn': 'Let the bar up with control · 2 s', 'Barı düz yukarı it · 1 sn': 'Press the bar straight up · 1 s',
      'Platformu it · 1 sn': 'Push the platform · 1 s', 'Kontrollü geri indir · 2 sn': 'Lower back with control · 2 s', 'İpi yüze çek · 1 sn': 'Pull the rope to your face · 1 s',
      'Kontrollü uzat · 2 sn': 'Extend with control · 2 s', 'Topukları aşağı-geri çek · 1 sn': 'Pull the heels down and back · 1 s', 'Kontrollü aç · 2 sn': 'Straighten with control · 2 s',
      'Topukları kalçaya çek · 1 sn': 'Curl the heels to the glutes · 1 s', 'İn · 2 sn': 'Lower · 2 s', 'Karnına çek · 1 sn': 'Pull to the belly · 1 s',
      'Kollarını kontrollü uzat · 2 sn': 'Extend the arms with control · 2 s', 'Göğsü bara çek · 1 sn': 'Pull the chest to the bar · 1 s', 'Kontrollü in · 2 sn': 'Lower with control · 2 s',
      'Kolları geriye aç · 1 sn': 'Open the arms back · 1 s', 'Kontrollü geri getir · 2 sn': 'Return with control · 2 s', 'Gir': 'Ease in', 'Tut': 'Hold', 'Bırak': 'Release',
      'Dizi duvara it · 2 sn': 'Knee towards the wall · 2 s', 'Bekle': 'Pause', 'Geri gel · 2 sn': 'Come back · 2 s', 'Yavaşça in': 'Lower slowly', 'Kalk': 'Stand up',
      'Burundan al · 4 sn': 'In through the nose · 4 s', 'Yavaşça ver · 6 sn': 'Breathe out slowly · 6 s',
      'düz omurga': 'neutral spine', 'baştan topuğa düz çizgi': 'straight line, head to heels', 'baştan ayağa düz çizgi': 'straight line, head to feet',
    },
    muscles: {
      'Ön bacak (kuadriseps)': 'Quads', 'Kalça (gluteus)': 'Glutes', 'İç bacak (adduktor)': 'Adductors (inner thigh)', 'Karın': 'Abs',
      'Bel (erektörler)': 'Lower back (erectors)', 'Göğüs': 'Chest', 'Ön omuz': 'Front delts', 'Arka kol (triceps)': 'Triceps', 'Sırt (latissimus)': 'Lats',
      'Orta sırt (trapez, romboid)': 'Mid back (traps, rhomboids)', 'Arka omuz': 'Rear delts', 'Pazu (biceps)': 'Biceps', 'Ön kol (tutuş)': 'Forearms (grip)',
      'Arka bacak (hamstring)': 'Hamstrings', 'Yan karın (oblik)': 'Obliques', 'Omuz (ön ve yan deltoid)': 'Shoulders (front and side delts)', 'Üst trapez': 'Upper traps',
      'Karın (sabitler)': 'Abs (bracing)', 'Rotator manşet': 'Rotator cuff', 'Baldır (gastroknemius)': 'Calves (gastrocnemius)',
      'Bel yanı (kuadratus lumborum)': 'Quadratus lumborum', 'Kalça yanı (gluteus medius)': 'Glute medius', 'Omuz': 'Shoulders', 'Baldır': 'Calves',
      'Kalça fleksörü (iliopsoas)': 'Hip flexors (iliopsoas)', 'Omuz (deltoid)': 'Shoulders (delts)', 'Trapez': 'Traps',
      'Piriformis (derin kalça)': 'Piriformis (deep hip)',
      'Ön bacak (rektus femoris)': 'Quads (rectus femoris)', 'Baldır (soleus)': 'Calves (soleus)', 'Bel': 'Lower back',
      'Boyun yanı (SKM, skalen)': 'Side of the neck (SCM, scalenes)',
      'Soleus (diz bükülünce)': 'Soleus (knee bent)', 'Yan gövde (oblik)': 'Side of the trunk (obliques)', 'Diyafram': 'Diaphragm',
      'Karın (nefes verirken)': 'Abs (on the exhale)',
    },
    joints: {
      'Kalça (öne açılma / ekstansiyon)': 'Hip (extension)', 'Kalça (bükülme / fleksiyon)': 'Hip (flexion)',
      'Kalça (öne-arkaya / fleksiyon, ekstansiyon)': 'Hip (flexion, extension)', 'Kalça (yana açılma / abdüksiyon)': 'Hip (abduction)',
      'Kalça (dışa dönme / dış rotasyon)': 'Hip (external rotation)', 'Diz (bükülme / fleksiyon)': 'Knee (flexion)', 'Diz (düzleşme / ekstansiyon)': 'Knee (extension)',
      'Ayak bileği (bükülme / dorsifleksiyon)': 'Ankle (dorsiflexion)', 'Göğüs omurgası (dönme / rotasyon)': 'Thoracic spine (rotation)',
      'Omurga (yuvarlama ve kavis / fleksiyon, ekstansiyon)': 'Spine (flexion, extension)', 'Omurga (yana eğilme / lateral fleksiyon)': 'Spine (side bend)',
      'Boyun (yana eğilme ve dönme)': 'Neck (side bend, rotation)', 'Omuz (dairesel / sirkümdüksiyon)': 'Shoulder (circumduction)',
      'Omuz (baş üstüne kaldırma / fleksiyon)': 'Shoulder (flexion, overhead)', 'Omuz (baş üstünden arkaya / fleksiyon, ekstansiyon)': 'Shoulder (flexion, then extension)',
      'Omuz (arkaya açılma / yatay abdüksiyon, dış rotasyon)': 'Shoulder (horizontal abduction, external rotation)',
    },
    tissue: {
      'Aşil tendonu': 'Achilles tendon', 'Hamstring tendonları': 'Hamstring tendons', 'Kalça eklem kapsülü (ön)': 'Anterior hip joint capsule', 'Torakolomber fasya': 'Thoracolumbar fascia',
    },
    photoNotes: {
      'goblet-squat': 'The photo shows a kettlebell; hold a dumbbell the same way.',
      'db-rdl': 'The photo shows the stiff-leg version; in the RDL the knees stay slightly bent.',
      'leg-swing': 'The photo is approximate; see the swing in the video.',
      'stick-pass-through': 'The photo shows a similar shoulder move; the exact move is in the video.',
      'cat-cow': 'The photo shows only the cat pose; see the video for the cow.',
      'hip-flexor-reach': 'The photo has no arm reach; see the reach in the video.',
      'lat-stretch-rail': 'The photo shows it against a wall; see the video for the rail version.',
      'quad-stretch': 'In the photo the back foot is on a step; you can also hold it by hand.',
      'assisted-pullup': 'The photo shows a band-assisted pull-up; on the machine the knees go on the pad, the movement is the same.',
      'db-split-squat': 'The photo has no dumbbells; hold them at your sides with straight arms.',
      'neck-tilt-turn': 'The photo shows a static stretch assisted by the hand; in the morning tilt and turn slowly without your hand.',
      'childs-pose-lat-stretch': 'The photo shows a plain child’s pose; keep your arms in front and walk your hands to one side.',
    },
    html: {
      'title': 'Antrenman',
      'tab.bugun': 'Today', 'tab.program': 'Program', 'tab.kurallar': 'Rules', 'tabs': 'Tabs',
      'p.sec': 'Section', 'p.sali': 'Day A', 'p.cuma': 'Day B', 'p.warm': 'Warm-up &amp; cool-down', 'p.gunluk': 'Daily stretching',
      'wk.close': 'Close workout mode', 'wk.time': 'Time', 'wk.steps': 'Session steps', 'wk.back': 'Previous step', 'wk.next': 'Next step', 'wk.prim': 'Start',
      'k.title': 'Rules', 'k.lead': 'Based on the Ağırsağlam plan. Day details are in the Program tab.',
      'k.hours': 'Gym hours',
      'k.hoursBox': `<b>Devlet Bahçeli Aile Yaşam ve Eğitim Merkezi</b>
      <p>Men: Tuesday and Friday 09:00–14:45, 16:00–21:45 (cleaning 15:00–16:00).</p>
      <p>Mixed: Saturday and Sunday 13:00–21:45. Closed on Wednesday; Monday and Thursday are for women.</p>
      <p><a class="lnk" href="https://www.etimesgut.bel.tr/storage/app/media/tesisler%20kullan%C4%B1m%20saatleri%20ve%20abonelik%20%C3%BCcretleri/devlet-bahceli-tesisleri-girisi.png" target="_blank" rel="noopener">Current timetable (Etimesgut Belediyesi)</a></p>
      <p class="muted">Hours can change from season to season.</p>`,
      'k.flow': 'Session flow',
      'k.flowBox': `<div class="flow"><span>Warm-up</span><i>→</i><span>Work sets</span><i>→</i><span>Cool-down</span></div>
      <ul>
        <li><b>Warm-up:</b> 5-10 min of cardio, then dynamic stretches.</li>
        <li><b>Work:</b> 1-2 light warm-up sets before each main lift (they don’t count as work sets).</li>
        <li><b>Cool-down:</b> static stretches, 30 s per muscle.</li>
      </ul>
      <p class="muted">Details: "Day A", "Day B" and "Warm-up &amp; cool-down" in the Program tab.</p>`,
      'k.plan': '3-month plan',
      'k.planBox': '<p><b>The accessory exercises change every 4 weeks.</b> The main lifts stay the same for all 12 weeks: goblet squat, dumbbell bench press, dumbbell RDL, deadlift 1×5, barbell overhead press.</p>',
      'k.blk': 'Block', 'k.b1': 'Block 1 <small>wk 1-4</small>', 'k.b2': 'Block 2 <small>wk 5-8</small>', 'k.b3': 'Block 3 <small>wk 9-12</small>',
      'k.whyBox': `<p class="muted">Why 4 weeks: Ağırsağlam advises keeping the accessory exercises for at least 4 weeks. Planned changes are fine; random, frequent changes can slow progress (Kassiano 2022).</p>
      <p><b>After 3 months:</b> you can add lateral raises, arms and calves.</p>
      <p class="muted">Change the active block with the picker in the Program tab.</p>`,
      'k.hard': 'How hard to push',
      'k.hardBox': `<ul>
        <li><b>Squat, deadlift, RDL:</b> stop 2 reps before failure (RIR 2)</li>
        <li><b>Bench, row, overhead press:</b> stop 1-2 reps before failure (RIR 1-2)</li>
        <li><b>Machines and light exercises</b> (lat pulldown, leg press, leg curl, face pull): on the last set, 0-1 reps in reserve is fine</li>
        <li><b>Push-ups:</b> stop 2 reps before failure</li>
      </ul>
      <p class="muted">RIR = reps left in reserve at the end of a set; RPE 8 = 2 reps left.</p>
      <p class="muted">Ağırsağlam: "RPE 9'u geçme, tükenişe gitme." (Don’t go past RPE 9; don’t train to failure.)</p>`,
      'k.prog': 'Adding weight',
      'k.progBox': `<div class="flow"><span>3×8</span><i>→</i><span>3×9</span><i>→</i><span>3×10</span><i>→</i><span>3×11</span><i>→</i><span>3×12</span><i>→</i><span class="fill">+kg</span><i>→</i><span>3×8</span></div>
      <ul>
        <li>Add reps first: from 3×8 up to 3×12.</li>
        <li>Once you reach 3×12, add a little weight and go back to 3×8.</li>
        <li>When you complete the deadlift 1×5, add 5 kg the next week.</li>
        <li>If the session felt harder than RPE 9, don’t add weight.</li>
        <li>If you stall for 3 sessions in a row, drop the weight by ~10% and build back up.</li>
      </ul>`,
      'k.rest': 'Rest',
      'k.restBox': `<ul>
        <li><b>Big lifts</b> (squat, deadlift, bench): 2-3 min</li>
        <li><b>Everything else:</b> 60-90 s</li>
      </ul>`,
      'k.first': 'First 2-3 weeks',
      'k.firstBox': '<p>Learn the movement, not the weight. Start light enough that 12 reps feel easy.</p>',
      'k.sun': 'Sunday',
      'k.sunBox': `<ul>
        <li><b>Zone 2 cardio</b> 30-40 min: a pace you can still talk at.</li>
        <li><b>Stretching:</b> the daily <a class="lnk" href="#program/gunluk">evening routine</a>.</li>
      </ul>`,
      'k.mob': 'Daily stretching',
      'k.mobBox': `<p>Two short routines every day, on top of training. <b>Morning (~6 min), dynamic:</b> opens up the joints with slow movement, no holding. <b>Evening (~8 min), static:</b> hold 30 s per side, a light stretch, not pain, breathe easy. Ağırsağlam also recommends dynamic stretching before training and static stretching after. According to ACSM, holding a static stretch for 10-30 s is enough, and doing it daily works best. Stretching doesn’t replace lifting: strength training through the full range of motion improves flexibility as much as stretching does (Afonso 2021).</p>
      <p>Stretching lengthens muscles and their tendons. Ligaments hold the joints stable and are not meant to be stretched, so stop at a mild stretch and back off if you feel pain in a joint.</p>
      <p><a class="lnk" href="https://web.archive.org/web/20240225082911/https://www.acsm.org/blog-detail/acsm-certified-blog/2021/03/18/stretching-and-flexibility-guidelines-update" target="_blank" rel="noopener">ACSM stretching guidelines (2021)</a> · <a class="lnk" href="https://doi.org/10.3390/healthcare9040427" target="_blank" rel="noopener">Afonso 2021</a></p>`,
      'k.src': 'Sources',
      'k.srcBox': '<p class="muted">Muscle map drawings: <a class="lnk" href="https://github.com/GV79/react-body-highlighter" target="_blank" rel="noopener">react-body-highlighter</a> (GV79, MIT license).</p>',
    },
  };
  window.FIT_EN = EN;

  /* ---------- FIT_I18N: language, UI strings, formatting ---------- */
  const listeners = new Set();
  const I = {
    get lang() { return lang; },
    get locale() { return LOC[lang]; },
    t(key, ...a) {
      const v = UI[key]; if (!v) return key;
      const s = v[lang === 'en' ? 1 : 0] ?? v[0];
      return typeof s === 'function' ? s(...a) : fill(s, a);
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setLang(l) {
      if ((l !== 'tr' && l !== 'en') || l === lang) return;
      lang = l; try { localStorage.setItem(LS, l); } catch { /* storage off */ }
      cache.clear(); I.apply();
      listeners.forEach((fn) => { try { fn(l); } catch (e) { console.error(e); } });
      window.dispatchEvent(new CustomEvent('fit-lang', { detail: { lang: l } }));
    },
    day(x, o = {}) {
      const d = x instanceof Date ? x : (() => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(x || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; })();
      if (!d) return String(x || '');
      const dm = d.toLocaleDateString(LOC[lang], { day: 'numeric', month: o.short ? 'short' : 'long' });
      if (!o.dow) return dm;
      const w = d.toLocaleDateString(LOC[lang], { weekday: 'long' });
      return o.dow === 'first' ? w + ', ' + dm : lang === 'en' ? w + ' ' + dm : dm + ' ' + w;
    },
    weekday(n) { const d = new Date(2026, 9, 18 + n); return d.toLocaleDateString(LOC[lang], { weekday: 'long' }); }, // 18 Oct 2026 is a Sunday
    num(n, frac = 2) { return n == null || n === '' ? '' : Number(n).toLocaleString(LOC[lang], { maximumFractionDigits: frac, useGrouping: false }); },
    lower(s) { return String(s).toLocaleLowerCase(LOC[lang]); },
    upper(s) { return String(s).toLocaleUpperCase(LOC[lang]); },
    cap(s) { s = String(s); return s.charAt(0).toLocaleUpperCase(LOC[lang]) + s.slice(1); },
    switchHtml() {
      return '<div class="langsw" role="group" aria-label="' + I.t('lang.group') + '">' + ['tr', 'en'].map((l) =>
        '<button type="button" data-lang="' + l + '" lang="' + l + '" aria-pressed="' + (l === lang) + '">' + l.toUpperCase() + '</button>').join('') + '</div>';
    },
    // index.html: data-i18n="key" -> innerHTML, data-i18n-aria="key" -> aria-label. Turkish is read from the page once.
    apply(root) {
      root = root || document;
      document.documentElement.lang = lang;
      if (!I._trTitle) I._trTitle = document.title;
      document.title = lang === 'en' ? EN.html.title : I._trTitle;
      root.querySelectorAll('[data-i18n]').forEach((el) => {
        if (el._tr == null) el._tr = el.innerHTML;
        const en = EN.html[el.dataset.i18n];
        el.innerHTML = lang === 'en' && en != null ? en : el._tr;
      });
      root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        if (el._trAria == null) el._trAria = el.getAttribute('aria-label') || '';
        const en = EN.html[el.dataset.i18nAria];
        el.setAttribute('aria-label', lang === 'en' && en != null ? en : el._trAria);
      });
      root.querySelectorAll('.langsw').forEach((g) => {
        g.setAttribute('aria-label', I.t('lang.group'));
        g.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
      });
    },
  };
  window.FIT_I18N = I;
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-lang]');
    if (b && b.closest('.langsw')) { ev.preventDefault(); I.setLang(b.dataset.lang); }
  });
  document.documentElement.lang = lang;

  /* ---------- FIT_tx: the program data in the active language ---------- */
  const cache = new Map(); // English entry copies, rebuilt after a switch
  const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);
  const P = (s) => (lang === 'en' && s != null && has(EN.phrases, s) ? EN.phrases[s] : s);
  const X = {
    phrase: P,
    muscle: (tr) => (lang === 'en' && has(EN.muscles, tr) ? EN.muscles[tr] : tr),
    joint: (tr) => (lang === 'en' && has(EN.joints, tr) ? EN.joints[tr] : tr),
    tissue: (tr) => (lang === 'en' && has(EN.tissue, tr) ? EN.tissue[tr] : tr),
    photoNote: (slug, tr) => (lang === 'en' && has(EN.photoNotes, slug) ? EN.photoNotes[slug] : tr),
    ex(x) {
      const e = typeof x === 'string' ? (window.FIT_EXERCISES || {})[x] : x;
      if (!e || lang !== 'en') return e;
      const slug = e.slug, en = (slug && EN.exercises[slug]) || {};
      if (slug && cache.has(slug) && cache.get(slug).src === e) return cache.get(slug).out;
      const o = Object.assign({}, e);
      delete o._c; // fl-exercise caches the compiled animation (with its labels) on the entry
      for (const k of ['name', 'sub', 'alt', 'note', 'avoid']) if (has(en, k)) o[k] = en[k];
      if (Array.isArray(en.cues) && en.cues.length === (e.cues || []).length) o.cues = en.cues;
      for (const k of ['dose', 'rest', 'rir', 'rirTag']) if (o[k] != null) o[k] = P(o[k]);
      if (e.video) o.video = Object.assign({}, e.video, has(en, 'vnote') ? { note: en.vnote } : {});
      if (e.anim) {
        o.anim = Object.assign({}, e.anim);
        if (e.anim.phases) o.anim.phases = e.anim.phases.map((p) => [P(p[0])].concat(p.slice(1)));
        if (e.anim.guide) o.anim.guide = Object.assign({}, e.anim.guide, { label: P(e.anim.guide.label) });
      }
      if (slug) cache.set(slug, { src: e, out: o });
      return o;
    },
    // a step from FIT_step / FIT_sessionSteps; key = its session
    step(st, key) {
      if (!st || lang !== 'en') return st;
      const base = (window.FIT_SESSIONS[key] || []).find((s) => s.id === (st.slot || st.id)) || st;
      const en = (EN.sessions[key] || {})[base.id] || {};
      const raw = base.variants && base.variants[st.block], vo = raw && typeof raw === 'object' ? raw : null;
      const o = Object.assign({}, st);
      if (st.type === 'exercise') { const e = X.ex(st.slug); if (e) o.name = e.name; }
      else if (st.phase === 'mob') { const e = X.ex(st.items[0].slug); if (e) o.name = e.name; }
      else if (has(en, 'name')) o.name = en.name;
      if (st.phase === 'mob') {
        const it = st.items[0];
        o.detail = P(it.dose) + (it.optional ? ' · ' + P('isteğe bağlı') : '') + (it.tip ? ' · ' + P(it.tip) : '');
      } else {
        const ev = vo && has(vo, 'detail') ? ((en.variants || {})[st.block] || {}) : en;
        if (has(ev, 'detail')) o.detail = ev.detail;
      }
      if (o.dose != null) o.dose = P(o.dose);
      if (o.reps != null) o.repsText = P(o.reps);
      if (st.items) o.items = st.items.map((it) => Object.assign({}, it, { dose: P(it.dose), tip: it.tip && P(it.tip), name: it.name && (X.ex(it.slug) || {}).name }));
      return o;
    },
    steps(key, block) { return (window.FIT_sessionSteps ? window.FIT_sessionSteps(key, block) : []).map((s) => X.step(s, key)); },
    meta(key) {
      const m = (window.FIT_SESSION_META || {})[key];
      if (!m || lang !== 'en') return m;
      return Object.assign({}, m, EN.meta[key] || {});
    },
    block(b) { return b && lang === 'en' && EN.blocks[b.n] ? Object.assign({}, b, { name: EN.blocks[b.n] }) : b; },
    // Turkish strings without English, for the test suite: [] when the overlay is complete
    missing() {
      const out = [], EXS = window.FIT_EXERCISES || {}, letters = /[a-zçğıöşü]/; // lowercase: 'RIR 2 · RPE 8' reads the same in both
      const need = (s, where) => { if (s != null && letters.test(s) && !has(EN.phrases, s)) out.push(where + ': ' + s); };
      for (const slug in EXS) {
        const e = EXS[slug], en = EN.exercises[slug];
        if (!en) { out.push(slug + ': no English entry'); continue; }
        for (const k of ['name', 'sub', 'alt', 'note', 'avoid']) if (e[k] && !has(en, k)) out.push(slug + ': no ' + k);
        if ((e.cues || []).length !== ((en.cues) || []).length) out.push(slug + ': cues ' + (e.cues || []).length + ' vs ' + ((en.cues) || []).length);
        if (e.video && e.video.note && !has(en, 'vnote')) out.push(slug + ': no vnote');
        for (const k of ['dose', 'rest', 'rir', 'rirTag']) need(e[k], slug + '.' + k);
        for (const m of [...((e.work || {}).main || []), ...((e.work || {}).help || [])]) if (!has(EN.muscles, m.tr)) out.push(slug + ': muscle ' + m.tr);
        for (const j of e.joints || []) if (!has(EN.joints, j)) out.push(slug + ': joint ' + j);
        for (const t of e.tissue || []) if (!has(EN.tissue, t)) out.push(slug + ': tissue ' + t);
        if (e.anim) { (e.anim.phases || []).forEach((p) => need(p[0], slug + ' phase')); if (e.anim.guide) need(e.anim.guide.label, slug + ' guide'); }
      }
      const SES = window.FIT_SESSIONS || {};
      for (const key in SES) {
        if (!EN.meta[key]) out.push(key + ': no meta');
        else for (const k of ['label', 'title', 'note']) if (window.FIT_SESSION_META[key][k] && !has(EN.meta[key], k)) out.push(key + ': meta ' + k);
        for (const s of SES[key]) {
          const en = (EN.sessions[key] || {})[s.id] || {};
          if (s.type !== 'exercise' && s.phase !== 'mob' && !has(en, 'name')) out.push(key + '.' + s.id + ': no name');
          if (s.phase !== 'mob' && s.detail && !has(en, 'detail')) out.push(key + '.' + s.id + ': no detail');
          need(s.dose, key + '.' + s.id + '.dose'); need(s.reps, key + '.' + s.id + '.reps');
          for (const it of s.items || []) { need(it.dose, key + '.' + s.id + ' item dose'); need(it.tip, key + '.' + s.id + ' item tip'); }
          for (const b in s.variants || {}) {
            const v = s.variants[b]; if (typeof v !== 'object') continue;
            if (v.detail && !has(((en.variants || {})[b] || {}), 'detail')) out.push(key + '.' + s.id + ' block ' + b + ': no detail');
            need(v.dose, key + '.' + s.id + ' block ' + b + ' dose'); need(v.reps, key + '.' + s.id + ' block ' + b + ' reps');
          }
        }
      }
      (window.FIT_BLOCKS || []).forEach((b) => { if (!EN.blocks[b.n]) out.push('block ' + b.n); });
      return out;
    },
  };
  window.FIT_tx = X;
})();
