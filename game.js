(() => {
'use strict';

// ---------- Константи ----------
const W = 480, H = 270;
const GROUND = 230;          // y поверхні землі
const SEG = 640;             // ширина одного року
const YEARS = 30;
const FINISH_X = (YEARS - 1) * SEG + 420;
const PORTED_FROM_YEAR = 21; // "Номер перенесено" лише в останні 10 років

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const $ = (id) => document.getElementById(id);
const ui = {
  start: $('start'), dialog: $('dialog'), finale: $('finale'), toast: $('toast'),
  dlgYear: $('dlg-year'), dlgTitle: $('dlg-title'), dlgText: $('dlg-text'),
  dlgOptions: $('dlg-options'), dlgReply: $('dlg-reply'), dlgNext: $('dlg-next'),
  btnStart: $('btn-start'), btnAgain: $('btn-again'), stats: $('stats'),
  greeting: $('greeting'), cake: $('cake'),
};

// ---------- Масштабування ----------
function fit() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H) * 2) / 2);
  $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit); fit();

// ---------- Звук ----------
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function beep(freq, dur, type = 'square', vol = 0.08, when = 0) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + dur);
  o.connect(g); g.connect(a.destination);
  o.start(a.currentTime + when); o.stop(a.currentTime + when + dur + 0.02);
}
const sfx = {
  jump: () => { beep(300, 0.08, 'square'); beep(500, 0.1, 'square', 0.06, 0.06); },
  candle: () => { beep(880, 0.07, 'square', 0.07); beep(1320, 0.12, 'square', 0.07, 0.07); },
  open: () => { beep(440, 0.06, 'triangle', 0.1); beep(660, 0.12, 'triangle', 0.1, 0.07); },
  pick: () => beep(600, 0.05, 'square', 0.06),
  coin: () => { beep(1175, 0.05, 'square', 0.06); beep(1568, 0.1, 'square', 0.06, 0.05); },
  notice: () => { beep(740, 0.06, 'square', 0.06); beep(988, 0.1, 'square', 0.06, 0.08); },
  bump: () => beep(120, 0.08, 'sawtooth', 0.08),
  hit: () => { beep(200, 0.1, 'sawtooth', 0.1); beep(140, 0.15, 'sawtooth', 0.1, 0.08); },
  fall: () => { [400, 300, 200, 120].forEach((f, i) => beep(f, 0.12, 'square', 0.07, i * 0.09)); },
  effect: () => { [523, 659, 784].forEach((f, i) => beep(f, 0.1, 'triangle', 0.1, i * 0.07)); },
  ported: () => { beep(523, 0.18, 'sine', 0.12); beep(659, 0.18, 'sine', 0.12, 0.2); beep(784, 0.25, 'sine', 0.12, 0.4); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.25, 'square', 0.08, i * 0.15)); },
};

// ---------- Випадковість (детермінована) ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- Контент: епохи ----------
function era(year) {
  if (year <= 4) return 'kid';
  if (year <= 15) return 'school';
  if (year <= 21) return 'uni';
  if (year <= 23) return 'diag';
  if (year === 24) return 'army';
  if (year <= 26) return 'sklad';
  return 'army';
}
const ERA_STYLE = {
  kid:    { sky: ['#8fd3ff', '#dff4ff'], hillFar: '#9ad68c', hillNear: '#5fb45a', ground: '#7b4b2a', grass: '#52a84a', shirt: '#ffd84a', pants: '#3b6fd1', hat: null, label: 'Дитинство' },
  school: { sky: ['#6fb7ff', '#cfe9ff'], hillFar: '#88c07a', hillNear: '#4f9c4b', ground: '#7b4b2a', grass: '#4d9f44', shirt: '#f4f0e6', pants: '#23263a', hat: null, label: 'Школа' },
  uni:    { sky: ['#5b8fe0', '#b8d4ff'], hillFar: '#7fa9c9', hillNear: '#4a7fa8', ground: '#5a5f7a', grass: '#7c829e', shirt: '#7b4fd1', pants: '#2f4a8a', hat: null, label: 'Універ' },
  diag:   { sky: ['#8bd0d8', '#e6fbff'], hillFar: '#b7dfe3', hillNear: '#8fc4cc', ground: '#5a5f7a', grass: '#c5ced6', shirt: '#3fa7d6', pants: '#2b5876', hat: null, label: 'Діагностичний' },
  army:   { sky: ['#a8c4b0', '#e8f0dc'], hillFar: '#8fae74', hillNear: '#5f8248', ground: '#5c4328', grass: '#6d8a3f', shirt: '#4e5f2c', pants: '#3f4d25', hat: '#3f4d25', label: 'Армія' },
  home:   { sky: ['#9fd0ff', '#e4f3ff'], hillFar: '#9ad68c', hillNear: '#5fb45a', ground: '#7b4b2a', grass: '#52a84a', shirt: '#5a5f7a', pants: '#2b2f40', hat: null, label: 'Село' },
  sklad:  { sky: ['#b9a98a', '#f0e6d2'], hillFar: '#c9b48e', hillNear: '#a78d62', ground: '#6b5a44', grass: '#8f8f8f', shirt: '#ff8c1a', pants: '#2b2f40', hat: null, label: 'Склад' },
};

// ---------- Контент: ефекти від відповідей ----------
const EFFECTS = {
  fast:  { label: 'ШВИДКІСТЬ ×1.5', desc: 'Швидкість ×1.5' },
  slow:  { label: 'ПОВІЛЬНО ×0.6', desc: 'Швидкість ×0.6' },
  jump:  { label: 'ВИСОКИЙ СТРИБОК', desc: 'Високий стрибок' },
  heavy: { label: 'ВАЖКИЙ', desc: 'Низький стрибок' },
  moon:  { label: 'НИЗЬКА ГРАВІТАЦІЯ', desc: 'Низька гравітація' },
  big:   { label: 'ВЕЛИКИЙ ДІМА', desc: 'Діма ×2' },
  small: { label: 'МАЛЕНЬКИЙ ДІМА', desc: 'Діма зменшився' },
};

// ---------- Контент: зупинки ----------
// opts: [текст, відповідь, ефект]
const MILESTONES = {
  1: { title: 'Народження',
    text: 'Пологовий будинок. На світ з\'явився Діма. Перше слово?',
    opts: [['Мама', 'Класика. Мама пишається і дає сил.', 'jump'],
           ['Тато', 'Тато теж пишається. Вчить бігати.', 'fast'],
           ['sudo', 'Так народжується сисадмін. Root-доступ до гравітації.', 'moon']] },
  5: { title: '1 клас у 5 років',
    text: 'Перший дзвоник. Тобі 5, усім іншим 6-7. Бантики, гладіолуси, сльози батьків. Що кладеш у портфель?',
    opts: [['Буквар і щоденник', 'Наймолодший відмінник. Але портфель більший за тебе.', 'slow'],
           ['Тамагочі', 'Тамагочі голодний. Біжи додому годувати!', 'fast'],
           ['Бутерброд від мами', 'Найважливіший предмет у школі. Ростеш на очах.', 'big']] },
  9: { title: '5 клас',
    text: 'Нові вчителі, нові кабінети, нові предмети. Тобі 9. Який улюблений?',
    opts: [['Інформатика', 'Пасьянс "Косинка" пройдено на 100%. Фізика тепер умовна.', 'moon'],
           ['Фізкультура', 'Вибір сильних. Норматив з бігу здано.', 'fast'],
           ['Перерва', 'Чесна відповідь. Але після перерви не розігнатись.', 'slow']] },
  13: { title: '9 клас',
    text: 'ДПА здано у 13. Куди далі?',
    opts: [['В 10-й клас, звісно', 'Ще два роки. Витримаєш. Стрибки допоможуть.', 'jump'],
           ['В коледж', 'Ні. Сюжет каже: в 10-й клас. І тягне назад.', 'heavy'],
           ['Поки що на перерву', 'Перерва триватиме ще два роки. Повільних.', 'slow']] },
  15: { title: 'Випускний у 15',
    text: 'Останній дзвоник продзвенів. Випускний вечір, а тобі ще нема 16. План?',
    opts: [['Танцювати до ранку', 'Ноги болять досі. Але темп набрано.', 'fast'],
           ['Зустріти світанок', 'Світанок зустрінуто. Разом з комарами. Не виспався.', 'slow'],
           ['Піти спати о 23:00', 'Ніхто не повірив. Зате виспався і стрибаєш.', 'jump']] },
  16: { title: '1 курс',
    text: 'Вступ на фахівця з інформаційних технологій у Рівному. Квартира дядька. Перша пара з програмування. Перша програма?',
    opts: [['Hello, World!', 'Стандарт. Компілюється. Впевненість росте.', 'jump'],
           ['Hello, Wordl!', 'Помилка в першій же програмі. Баг у фізиці.', 'heavy'],
           ['Ctrl+C, Ctrl+V', 'Так, це теж програмування. І дуже швидке.', 'fast']] },
  17: { title: '2 курс. Мат аналіз',
    text: 'Сапіліді Тамара Михайлівна підходить до парти і дивиться в твій зошит. Що там?',
    opts: [['Інтеграли', 'Рідкісний випадок. Тамара Михайлівна здивована. Ти теж.', 'jump'],
           ['Чистий аркуш', 'Вона бере ручку. Зараз буде слон.', 'slow'],
           ['Слон, якого вона сама намалювала', 'Колекція слонів поповнена. Двієчник з досвідом.', 'moon']] },
  19: { title: 'Диплом',
    text: 'Дипломна: сайт колекції монет на чистому HTML. Керівник Каштан. За годину до захисту сторінка перестала відкриватись. Що робиш?',
    opts: [['Закоментувати половину коду', 'Сторінка відкрилась. Монет стало вдвічі менше. Легкість.', 'moon'],
           ['Дзвонити Каштану', 'Каштан каже: "Перезавантаж". Допомогло. Біжимо на захист.', 'fast'],
           ['Додати ще одну монету', 'Каштан оцінив монету. Комісія оцінила диплом. Ростеш.', 'big']] },
  23: { title: 'Мед. діагностичний',
    text: 'Третій рік сисадміном у медичному діагностичному центрі. Дзвінок з реєстратури: "У нас не працює інтернет!"',
    opts: [['А ви пробували вимкнути і ввімкнути?', 'Запрацювало. Дзвонять знову за 10 хвилин. Бігом.', 'fast'],
           ['Перезавантажити роутер', 'Роутер 2009 року оживає втретє за день. Повільно.', 'slow'],
           ['Це не баг, це фіча', 'Реєстратура не оцінила гумор. Гравітація оцінила.', 'moon']] },
  24: { title: 'Строкова служба',
    text: 'Строкова. Шикування. Сержант: "Хто тут айтішник?"',
    opts: [['Я!', 'Тепер ти відповідаєш за принтер усієї частини. Він важкий.', 'heavy'],
           ['Мовчати', 'Все одно знайшли. Ти намагався стати непомітним.', 'small'],
           ['Налаштувати Wi-Fi в казармі', 'Найповажніша людина в роті. Пінг мінімальний.', 'fast']] },
  25: { title: 'Склад',
    text: 'Склад побутових товарів. Прийшла палета на 400 коробок. План дій?',
    opts: [['Оптимізувати логістику', 'Написав табличку в Excel. Начальник вражений. Усе летить.', 'fast'],
           ['Тетріс із коробок', 'Склав ідеально. Жодного зазору. Спина стала ширшою.', 'big'],
           ['Знайти навантажувач', 'Навантажувач зайнятий. Руками, як завжди. Повільно.', 'slow']] },
  27: { title: 'Контракт',
    text: 'Підписано контракт. Тепер ти військовий. Що береш із собою?',
    opts: [['Ноутбук', 'Правильно. Ігри самі себе не пройдуть. Реакція +.', 'jump'],
           ['Каву', 'Без неї ніяк. Ні на службі, ні в житті. Прискорення.', 'fast'],
           ['Друзів у телефоні', 'Вони дзвонитимуть. Часто. Легше на душі.', 'moon']] },
};

const YEAR_NOTICES = {
  1: 'Народився. 3,4 кг чистого потенціалу.',
  2: 'Перші зуби. Перша покусана мама.',
  3: 'Навчився ходити. І падати.',
  4: 'Зʼїв пісок. Смачно. Полуницю краще не треба.',
  5: 'Перший дзвоник у 5 років. Наймолодший у класі.',
  6: 'Навчився читати. Читає лише коди до ігор.',
  7: 'Перший велосипед. Перше розбите коліно.',
  8: 'Перша гра на компʼютері в сусіда. Назавжди.',
  9: '5 клас. Десять вчителів замість одного.',
  10: 'Косинка пройдена. Сапер поки що ні.',
  11: 'Перша двійка. Щоденник загублено.',
  12: 'Голос ламається. Авторитет теж.',
  13: 'ДПА здано у 13. Вижив.',
  14: 'Дискотека в сільському клубі. Перший мідляк.',
  15: 'Випускний. ЗНО здано у 15.',
  16: 'Вступ на IT. Рівне, квартира дядька.',
  17: 'Мат аналіз. Сапіліді малює слонів у зошитах.',
  18: 'Пари о 8:00. Проспав усі.',
  19: 'Диплом: сайт колекції монет. Керівник Каштан.',
  20: 'Диплом бакалавра в руках. Далі магістратура, ще 1,5 року.',
  21: 'Магістр удень, сисадмін у діагностичному ввечері.',
  22: 'Магістра здано. Сисадміном залишився.',
  23: 'Діагностичний. Головний ворог: принтер.',
  24: 'Строкова. Підйом о 6:00.',
  25: 'Склад. Палета №47 прибула.',
  26: 'Новий ноутбук. Ігри встановлено.',
  27: 'Контракт підписано.',
  28: 'Кава, ноутбук, служба.',
  29: 'Друзі дзвонять. Часто.',
};

// Етапи руху за віком
function ageMove(y) {
  if (y <= 2) return { mode: 'crawl', label: 'ПОВЗЕ', speed: 0.55, jump: 0.72 };
  if (y <= 4) return { mode: 'walk', label: 'ІДЕ', speed: 0.8, jump: 0.95 };
  if (y <= 11) return { mode: 'walk', label: 'ІДЕ', speed: 0.95, jump: 1 };
  return { mode: 'run', label: 'БІЖИТЬ', speed: 1.12, jump: 1 };
}

const GREETING =
`Дімітріусе, з 30-річчям!

Тридцять рівнів пройдено. Ти питав, як би Ісус зробив на твоєму місці. Відповідаю. Настанови від Ісуса:

1. Заряджай ноутбук щовечора, бо гра сама себе не пройде.
2. Каву пий, але й воду теж. Про воду в Писанні теж щось було.
3. Не перезавантажуй роутер більше трьох разів на день. Після третього він ображається.
4. Ділись Wi-Fi з ближнім своїм.
5. Не відповідай на дзвінки о 6 ранку. Крім підйому. І крім мене.
6. Не осуджуй принтер. Він теж не хотів тут бути.
7. Монети збирай, але свічки на торті важливіші.
8. Люби ближнього свого, навіть якщо він грає за іншу команду.
9. У складних ситуаціях питай: "А як би Ісус зробив на моєму місці?" І роби навпаки, бо він в айті не розбирається.
10. Будь здоровий, бережи себе і нехай небо над тобою буде спокійним.

Амінь.
Ісус`;

// ---------- Спрайти ----------
const PAL = { H: '#4a2c17', S: '#f1c27d', E: '#222', B: '#222', M: '#c97a5a' };

// Голова (6 рядків), A = кепка
const HEAD = [
  '..AAAAAA..',
  '..HHHHHH..',
  '.HHSSSSHH.',
  '.HSESSES..',
  '..SSSSSS..',
  '...SMMS...',
];
// Ростові стадії: [рядків тулуба, рядків ніг]
const STAGES = [[2, 2], [3, 3], [3, 4], [4, 5], [4, 6]];
function stageForYear(y) { return y <= 3 ? 0 : y <= 6 ? 1 : y <= 11 ? 2 : y <= 15 ? 3 : 4; }

function place(segs) { // segs: [[col, 'PP'], ...] -> рядок шириною 10
  const a = Array(10).fill('.');
  for (const [c, s] of segs) for (let i = 0; i < s.length; i++) { const k = c + i; if (k >= 0 && k < 10) a[k] = s[i]; }
  return a.join('');
}
function buildSprite(torso, legs) {
  const body = [...HEAD];
  for (let i = 0; i < torso; i++) body.push(i === 0 || i === torso - 1 ? '..CCCCCC..' : '.SCCCCCCS.');
  const mk = (kind) => {
    const rows = ['..PPPPPP..'];
    for (let k = 1; k < legs; k++) {
      const o = kind === 'spread' || kind === 'jump' ? Math.round((k / Math.max(1, legs - 1)) * 2) : 0;
      if (kind === 'together') rows.push(place([[3, 'PPPP']]));
      else rows.push(place([[2 - o, 'PP'], [6 + o, 'PP']]));
    }
    if (kind === 'stand') rows.push('.BBB..BBB.');
    else if (kind === 'together') rows.push('..BBBBBB..');
    else if (kind === 'spread') rows.push(place([[-1, 'BBB'], [8, 'BBB']]));
    else rows.push(place([[0, 'B'], [8, 'B']]));
    return rows;
  };
  return { body, legs: [mk('stand'), mk('spread'), mk('together'), mk('jump')], h: body.length + legs + 1 };
}
const SPRITES = STAGES.map(([t, l]) => buildSprite(t, l));
const CRAWL = [
  [ '.......HHHH.',
    '......HSSSSH',
    '.CCCCCHSESSE',
    'CCCCCCCSSSSS',
    'SCCCCCCC.MM.',
    '.PPPPPS.....',
    '.PP..PP..S..',
    '.BB..BB.....' ],
  [ '.......HHHH.',
    '......HSSSSH',
    '.CCCCCHSESSE',
    'CCCCCCCSSSSS',
    '.CCCCCCCSMM.',
    '.PPPPP..S...',
    '..PP.PP.....',
    '..BB..BB....' ],
];
const CRAWL_H = 8, CRAWL_W = 12;

function drawPixels(rows, x, y, colors, flip = false, s = 1) {
  const w = rows[0].length;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const col = colors[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      const px = flip ? x + (w - 1 - c) * s : x + c * s;
      ctx.fillRect(px, y + r * s, s, s);
    }
  }
}

function isCrawling() { return ageMove(currentYear()).mode === 'crawl' && !(effect && effect.type === 'big'); }
function playerSprite() {
  const st = effect && effect.type === 'small' ? 0 : stageForYear(currentYear());
  return SPRITES[st];
}
function playerScale() { return effect && effect.type === 'big' ? 2 : 1; }
function playerH() { return isCrawling() ? CRAWL_H : playerSprite().h * playerScale(); }
function playerW() { return isCrawling() ? 10 : 8 * playerScale(); }

function drawPlayer(p, style) {
  const colors = Object.assign({}, PAL, { C: style.shirt, P: style.pants, A: style.hat });
  if (p.stun > 0 && Math.floor(time * 20) % 2) return;
  if (isCrawling()) {
    const f = Math.abs(p.vx) > 5 ? Math.floor(p.animT * 6) % 2 : 0;
    drawPixels(CRAWL[f], Math.round(p.x - 6), Math.round(p.y - CRAWL_H), colors, p.facing < 0, 1);
    return;
  }
  const sp = playerSprite(), s = playerScale();
  const animRate = ageMove(currentYear()).mode === 'run' ? 12 : 8;
  const frame = !p.onGround ? 3 : (Math.abs(p.vx) > 5 ? (1 + (Math.floor(p.animT * animRate) % 2)) : 0);
  const sx = Math.round(p.x - 5 * s), sy = Math.round(p.y - sp.h * s);
  const flip = p.facing < 0;
  drawPixels(sp.body, sx, sy, colors, flip, s);
  drawPixels(sp.legs[frame], sx, sy + sp.body.length * s, colors, flip, s);
}

function drawCandle(x, y, t) {
  ctx.fillStyle = '#f4f0e6'; ctx.fillRect(x, y + 3, 3, 6);
  ctx.fillStyle = '#e04a5a'; ctx.fillRect(x, y + 5, 3, 1); ctx.fillRect(x, y + 7, 3, 1);
  const fl = Math.floor(t * 10) % 2;
  ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + 1, y + 1 - fl, 1, 2 + fl);
  ctx.fillStyle = '#ff8c1a'; ctx.fillRect(x + 1, y + 2, 1, 1);
}

function drawCoin(x, y, t) {
  const f = Math.floor(t * 6 + x / 7) % 4; // обертання
  const w = f === 0 ? 5 : f === 2 ? 1 : 3;
  const ox = Math.floor((5 - w) / 2);
  ctx.fillStyle = '#e0a21a'; ctx.fillRect(x + ox, y, w, 6);
  ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + ox, y + 1, w, 4);
  if (w >= 3) { ctx.fillStyle = '#e0a21a'; ctx.fillRect(x + 2, y + 2, 1, 2); }
  if (w === 5) { ctx.fillStyle = '#fff2a8'; ctx.fillRect(x + 1, y + 1, 1, 1); }
}

// Перешкоди за епохою
function drawObstacle(o, t) {
  const { x, y, w, h, kind, seed } = o;
  switch (kind) {
    case 'kid': {
      const cols = ['#e04a5a', '#3b6fd1', '#52a84a', '#ffd84a'];
      let i = seed;
      for (let yy = y + h - 8; yy >= y; yy -= 8)
        for (let xx = x; xx < x + w; xx += 8) {
          ctx.fillStyle = cols[i++ % 4]; ctx.fillRect(xx, yy, 8, 8);
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(xx, yy + 7, 8, 1); ctx.fillRect(xx + 7, yy, 1, 8);
        }
      break;
    }
    case 'school': {
      ctx.fillStyle = '#c98a4b'; ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x + 1, y + 4, 3, h - 4); ctx.fillRect(x + w - 4, y + 4, 3, h - 4);
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(x + 3, y - 2, 6, 2);
      break;
    }
    case 'uni': {
      const cols = ['#7b4fd1', '#e04a5a', '#3fa7d6', '#52a84a', '#ffd84a'];
      let i = seed, yy = y + h;
      while (yy > y) { yy -= 4; ctx.fillStyle = cols[i++ % cols.length]; ctx.fillRect(x + (i % 2), yy, w - 1, 4); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x + (i % 2), yy, w - 1, 1); }
      break;
    }
    case 'home':
    case 'diag': {
      ctx.fillStyle = '#2a2e45'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#5a5f7a';
      for (let yy = y + 2; yy < y + h - 2; yy += 4) ctx.fillRect(x + 2, yy, w - 4, 2);
      const blink = Math.floor(t * 6 + seed) % 3;
      ctx.fillStyle = blink ? '#52e05a' : '#e04a5a'; ctx.fillRect(x + w - 4, y + 2, 1, 1);
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + w - 4, y + 6, 1, 1);
      break;
    }
    case 'army': {
      for (let yy = y + h - 5; yy >= y; yy -= 5) {
        const off = ((y + h - yy) / 5) % 2 ? 4 : 0;
        for (let xx = x - off; xx < x + w; xx += 9) {
          const sx = Math.max(xx, x), sw = Math.min(8, x + w - sx);
          ctx.fillStyle = '#a99766'; ctx.fillRect(sx, yy, sw, 5);
          ctx.fillStyle = '#7d6e48'; ctx.fillRect(sx, yy + 4, sw, 1);
        }
      }
      break;
    }
    case 'sklad': {
      for (let yy = y + h - 12; yy >= y; yy -= 12)
        for (let xx = x; xx < x + w; xx += 12) {
          ctx.fillStyle = '#c98a4b'; ctx.fillRect(xx, yy, 12, 12);
          ctx.fillStyle = '#8a5a2b'; ctx.fillRect(xx, yy, 12, 1); ctx.fillRect(xx, yy, 1, 12); ctx.fillRect(xx + 11, yy, 1, 12); ctx.fillRect(xx, yy + 11, 12, 1);
          ctx.fillStyle = '#e8d3a8'; ctx.fillRect(xx + 5, yy, 2, 12);
        }
      break;
    }
  }
}

// Рухомі небезпеки
function drawHazard(hz, t) {
  const x = Math.round(hz.x), y = Math.round(hz.y + Math.sin(t * 5 + hz.x0) * 1.5);
  switch (hz.kind) {
    case 'school': // контрольна
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(x, y, 9, 11);
      ctx.fillStyle = '#e04a5a'; ctx.fillRect(x + 2, y + 2, 5, 1); ctx.fillRect(x + 2, y + 5, 5, 1); ctx.fillRect(x + 2, y + 8, 3, 1);
      ctx.fillStyle = '#222'; ctx.fillRect(x + 6, y + 8, 2, 2);
      break;
    case 'uni': // дедлайн
      ctx.fillStyle = '#e04a5a'; ctx.fillRect(x, y, 10, 10);
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(x + 4, y + 2, 2, 4); ctx.fillRect(x + 4, y + 7, 2, 2);
      break;
    case 'diag': // вірус
      ctx.fillStyle = '#52e05a'; ctx.fillRect(x + 2, y, 6, 10); ctx.fillRect(x, y + 2, 10, 6);
      ctx.fillStyle = '#1a1d2b'; ctx.fillRect(x + 3, y + 3, 1, 1); ctx.fillRect(x + 6, y + 3, 1, 1); ctx.fillRect(x + 3, y + 6, 4, 1);
      break;
    case 'army': // дрон
      ctx.fillStyle = '#5a5f7a'; ctx.fillRect(x + 2, y + 3, 8, 4); ctx.fillRect(x, y + 1, 3, 2); ctx.fillRect(x + 9, y + 1, 3, 2);
      ctx.fillStyle = Math.floor(t * 30) % 2 ? '#cfd3e6' : '#5a5f7a'; ctx.fillRect(x - 1, y, 5, 1); ctx.fillRect(x + 8, y, 5, 1);
      ctx.fillStyle = '#e04a5a'; ctx.fillRect(x + 5, y + 7, 2, 1);
      break;
    case 'berry': // полуниця
      ctx.fillStyle = '#52a84a'; ctx.fillRect(x + 1, y, 6, 2); ctx.fillRect(x + 3, y - 1, 2, 1);
      ctx.fillStyle = '#e04a5a'; ctx.fillRect(x, y + 2, 8, 3); ctx.fillRect(x + 1, y + 5, 6, 2); ctx.fillRect(x + 2, y + 7, 4, 1);
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + 2, y + 3, 1, 1); ctx.fillRect(x + 5, y + 4, 1, 1); ctx.fillRect(x + 3, y + 6, 1, 1);
      break;
    case 'sklad': // коробка, що котиться
      ctx.fillStyle = '#c98a4b'; ctx.fillRect(x, y, 10, 10);
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x, y, 10, 1); ctx.fillRect(x, y + 9, 10, 1); ctx.fillRect(x, y, 1, 10); ctx.fillRect(x + 9, y, 1, 10);
      ctx.fillStyle = '#e8d3a8'; ctx.fillRect(x + 4, y, 2, 10);
      break;
  }
}

// ---------- Світ ----------
let world, player, state, time, lastT, keys, portedCount, nextToast, candlesGot, coinsGot, bumpT, effect, lastWasPorted, falls, hits, allergies, berryTouches, toastBusy;

function buildWorld() {
  const r = rng(30);
  const obstacles = [], candles = [], signs = [], triggers = [], pits = [], hazards = [], yearMarks = [], coins = [];
  for (let y = 1; y <= YEARS; y++) {
    const base = (y - 1) * SEG;
    signs.push({ x: base + 24, year: y });
    if (y < YEARS) yearMarks.push({ x: base + 50, year: y, done: false });
    const e = era(y);
    const hasStop = !!MILESTONES[y];
    if (hasStop) triggers.push({ x: base + 230, year: y, done: false });
    if (y === YEARS) { candles.push({ x: base + 250, y: GROUND - 40, got: false }); continue; }

    // Складність зростає з роками
    const diff = (y - 1) / (YEARS - 2); // 0..1
    const count = hasStop ? 2 + Math.floor(diff * 2) : 2 + Math.floor(diff * 3 + r() * 0.9);
    const hmax = Math.min(26, 14 + Math.floor(y / 2.5));
    let x = base + (hasStop ? 330 : 170);
    const used = []; // зайняті інтервали [x0,x1]
    for (let i = 0; i < count && x < base + SEG - 80; i++) {
      let w, h;
      if (e === 'kid') { w = 16; h = y >= 4 ? 16 : 8; }
      else if (e === 'sklad') { w = 12 * (1 + Math.floor(r() * 2)); h = 12 * (1 + Math.floor(r() * 2)); }
      else { w = 12 + Math.floor(r() * 12); h = 10 + Math.floor(r() * (hmax - 10)); }
      obstacles.push({ x, y: GROUND - h, w, h, kind: e, seed: Math.floor(r() * 100) });
      used.push([x - 14, x + w + 14]);
      x += w + 50 + Math.floor(r() * (110 - diff * 60));
    }
    // Ями з 10 року
    const nPits = y >= 6 ? (r() < (y - 3) / 20 ? 1 : 0) + (y >= 18 && r() < 0.5 ? 1 : 0) : 0;
    for (let k = 0; k < nPits; k++) {
      const pw = 26 + Math.floor(diff * 18);
      for (let attempt = 0; attempt < 12; attempt++) {
        let px = base + 120 + Math.floor(r() * (SEG - 260));
        if (hasStop && px < base + 330) px = base + 330 + Math.floor(r() * 100);
        let ok = true;
        for (const [a, b] of used) if (px + pw > a && px < b) ok = false;
        if (ok) { pits.push({ x: px, w: pw }); used.push([px - 10, px + pw + 10]); break; }
      }
    }
    // Рухомі небезпеки з 13 року
    const nHaz = y >= 9 ? (r() < (y - 5) / 20 ? 1 : 0) + (y >= 18 && r() < 0.6 ? 1 : 0) : 0;
    for (let k = 0; k < nHaz; k++) {
      const range = 70 + Math.floor(r() * 60);
      let hx = base + 150 + Math.floor(r() * (SEG - 300 - range));
      if (hasStop && hx < base + 340) hx = base + 340;
      hazards.push({ x0: hx, x1: hx + range, x: hx, y: GROUND - 16 - Math.floor(r() * 14), dir: k % 2 ? -1 : 1, speed: 50 + diff * 70, kind: e === 'kid' ? 'school' : e === 'home' ? 'diag' : e });
    }
    // полуниця: алергія
    if (y >= 3 && r() < 0.45) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const bx = base + 100 + Math.floor(r() * (SEG - 200));
        if (hasStop && bx > base + 180 && bx < base + 340) continue;
        if (used.some(([a, b]) => bx + 8 > a && bx < b)) continue;
        hazards.push({ x0: bx, x1: bx, x: bx, y: GROUND - 8, dir: 1, speed: 0, kind: 'berry' });
        used.push([bx - 6, bx + 14]);
        break;
      }
    }
    // монети: над перешкодами, над ямами, і просто на шляху
    const yearObs = obstacles.filter(o => o.x >= base && o.x < base + SEG);
    const yearPits = pits.filter(pt => pt.x >= base && pt.x < base + SEG);
    for (const o of yearObs) if (r() < 0.75) coins.push({ x: o.x + Math.floor(o.w / 2) - 2, y: o.y - 12, got: false });
    for (const pt of yearPits) coins.push({ x: pt.x + Math.floor(pt.w / 2) - 2, y: GROUND - 34, got: false });
    const nFree = 1 + Math.floor(r() * 2);
    for (let k = 0; k < nFree; k++) {
      let fx = base + 80 + Math.floor(r() * (SEG - 160));
      if (hasStop && fx > base + 200 && fx < base + 330) fx += 180;
      if (coins.some(c => Math.abs(c.x - fx) < 14)) continue;
      if (yearObs.some(o => fx + 5 > o.x - 6 && fx < o.x + o.w + 6)) continue;
      if (yearPits.some(pt => fx + 5 > pt.x && fx < pt.x + pt.w)) continue;
      coins.push({ x: fx, y: GROUND - 10 - Math.floor(r() * 3) * 8, got: false });
    }
    let cx = base + 90 + Math.floor(r() * 460);
    for (const pt of pits) if (cx > pt.x - 10 && cx < pt.x + pt.w + 10) cx = pt.x + pt.w + 30;
    candles.push({ x: cx, y: GROUND - 28 - Math.floor(r() * 18), got: false });
  }
  const clouds = [];
  for (let i = 0; i < 9; i++) clouds.push({ x: r() * 1400, y: 20 + r() * 70, w: 24 + r() * 30 });
  return { obstacles, candles, signs, triggers, pits, hazards, clouds, yearMarks, coins };
}

function reset() {
  world = buildWorld();
  player = { x: 40, y: GROUND, vx: 0, vy: 0, onGround: true, facing: 1, animT: 0, stun: 0 };
  state = 'start';
  time = 0; lastT = performance.now();
  keys = {};
  bumpT = 0; effect = null; lastWasPorted = false; falls = 0; hits = 0; allergies = 0; berryTouches = 0;
  portedCount = 0; candlesGot = 0; coinsGot = 0;
  nextToast = 8 + Math.random() * 6; toastBusy = 0;
  ui.toast.classList.remove('show');
}

// ---------- Ввід ----------
addEventListener('keydown', (e) => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  keys[e.code] = true;
  if (state === 'start' && (e.key === 'Enter' || e.key === ' ')) startGame();
  else if (state === 'dialog') dialogKey(e);
  else if (state === 'finale' && e.key === 'Enter' && !ui.btnAgain.classList.contains('hidden')) restart();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
ui.btnStart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', restart);

function startGame() {
  audio(); sfx.open();
  ui.start.classList.remove('visible');
  state = 'play';
}
function restart() {
  ui.finale.classList.remove('visible');
  reset();
  startGame();
}

// ---------- Сповіщення ----------
let toastTimer = null;
function showToast(head, text, ported, warn = false) {
  ui.toast.querySelector('.toast-head').textContent = head;
  ui.toast.querySelector('.toast-text').textContent = text;
  ui.toast.classList.toggle('alt', !ported && !warn);
  ui.toast.classList.toggle('warn', warn);
  ui.toast.classList.remove('show');
  void ui.toast.offsetWidth;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastBusy = time + 2.8;
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2600);
}
function showPorted() {
  portedCount++;
  sfx.ported();
  showToast('lifecell', 'Номер перенесено', true);
}
function showYearNotice(year) {
  const text = YEAR_NOTICES[year];
  if (!text) return;
  sfx.notice();
  showToast('РІК ' + year, text, false);
}
function showNotice() { showYearNotice(currentYear()); }

// ---------- Діалог ----------
let dlg = null;
function openDialog(year) {
  const m = MILESTONES[year];
  state = 'dialog';
  player.vx = 0;
  sfx.open();
  const opts = m.opts.map((o) => ({ label: o[0], reply: o[1], fx: o[2] }));
  dlg = { year, opts, sel: 0, answered: false };
  ui.dlgYear.textContent = `РІК ${year} · ${ERA_STYLE[era(year)].label.toUpperCase()}`;
  ui.dlgTitle.textContent = m.title;
  ui.dlgText.textContent = m.text;
  ui.dlgReply.innerHTML = '';
  ui.dlgNext.classList.add('hidden');
  ui.dlgOptions.innerHTML = '';
  opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="n">${i + 1}</span>${o.label}`;
    b.addEventListener('click', () => chooseOption(i));
    b.addEventListener('mouseenter', () => { if (!dlg.answered) { dlg.sel = i; renderSel(); } });
    ui.dlgOptions.appendChild(b);
  });
  renderSel();
  ui.dialog.classList.add('visible');
}
function renderSel() {
  [...ui.dlgOptions.children].forEach((b, i) => b.classList.toggle('sel', i === dlg.sel));
}
function chooseOption(i) {
  if (!dlg || dlg.answered) return;
  const o = dlg.opts[i];
  dlg.answered = true;
  sfx.pick();
  [...ui.dlgOptions.children].forEach((b, j) => { b.disabled = true; b.classList.toggle('sel', j === i); b.classList.toggle('hidden', j !== i); });
  const fx = EFFECTS[o.fx];
  ui.dlgReply.innerHTML = `${o.reply}<br><span class="fx">Ефект до року ${dlg.year + 2}: ${fx.desc}</span>`;
  effect = { type: o.fx, untilX: (dlg.year + 1) * SEG };
  ui.dlgNext.classList.remove('hidden');
}
function closeDialog() {
  ui.dialog.classList.remove('visible');
  dlg = null;
  state = 'play';
  sfx.effect();
}
ui.dlgNext.addEventListener('click', closeDialog);
function dialogKey(e) {
  if (!dlg) return;
  if (!dlg.answered) {
    if (e.key === 'ArrowDown' || e.code === 'KeyS') { dlg.sel = (dlg.sel + 1) % dlg.opts.length; renderSel(); }
    else if (e.key === 'ArrowUp' || e.code === 'KeyW') { dlg.sel = (dlg.sel - 1 + dlg.opts.length) % dlg.opts.length; renderSel(); }
    else if (e.key === 'Enter' || e.key === ' ') chooseOption(dlg.sel);
    else if (/^[1-3]$/.test(e.key)) { const i = +e.key - 1; if (i < dlg.opts.length) chooseOption(i); }
  } else if (e.key === 'Enter' || e.key === ' ') closeDialog();
}

// ---------- Фінал ----------
function drawCake() {
  const c = ui.cake.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, 96, 64);
  c.fillStyle = '#cfd3e6'; c.fillRect(6, 58, 84, 4);
  c.fillStyle = '#c98a4b'; c.fillRect(12, 42, 72, 16);
  c.fillStyle = '#e04a5a'; c.fillRect(12, 42, 72, 4);
  c.fillStyle = '#f4f0e6'; c.fillRect(12, 46, 72, 2);
  c.fillStyle = '#c98a4b'; c.fillRect(22, 28, 52, 14);
  c.fillStyle = '#ffb6c1'; c.fillRect(22, 28, 52, 4);
  c.fillStyle = '#f4f0e6'; c.fillRect(22, 32, 52, 2);
  c.fillStyle = '#1a1d2b';
  const three = ['111', '..1', '111', '..1', '111'], zero = ['111', '1.1', '1.1', '1.1', '111'];
  [three, zero].forEach((g, k) => g.forEach((row, r) => [...row].forEach((ch, cc) => { if (ch === '1') c.fillRect(40 + k * 9 + cc * 2, 48 + r * 2, 2, 2); })));
  const n = Math.min(30, candlesGot);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 10), col = i % 10;
    const x = 48 - 22.5 + col * 5 + (row % 2) * 2;
    const y = 18 - row * 6;
    c.fillStyle = i % 2 ? '#3fa7d6' : '#e04a5a'; c.fillRect(Math.round(x), y + 4, 2, 6);
    c.fillStyle = '#ffd84a'; c.fillRect(Math.round(x), y + 1, 2, 3);
    c.fillStyle = '#ff8c1a'; c.fillRect(Math.round(x), y + 3, 2, 1);
  }
}
let confetti = [];
function openFinale() {
  state = 'finale';
  effect = null;
  sfx.win();
  drawCake();
  const total = YEARS;
  let candleLine;
  if (candlesGot >= total) candleLine = `Усі ${total} свічок на торті. Ідеальне проходження!`;
  else if (candlesGot === 0) candleLine = `Свічок: 0 з ${total}. Торт без свічок. Задувати нічого, але їсти можна.`;
  else candleLine = `Свічок на торті: ${candlesGot} з ${total}. Решту задуєш наступного року.`;
  const coinTotal = world.coins.length, cr = coinsGot / coinTotal;
  let coinLine;
  if (coinsGot >= coinTotal) coinLine = `Монети: ${coinsGot} з ${coinTotal}. Колекція повна, сайт монет оновлено.`;
  else if (cr >= 0.7) coinLine = `Монети: ${coinsGot} з ${coinTotal}. Солідна колекція. Нумізмати схвалюють.`;
  else if (cr >= 0.4) coinLine = `Монети: ${coinsGot} з ${coinTotal}. Половина колекції. Решта лишилась на сайті з 4 курсу.`;
  else if (coinsGot > 0) coinLine = `Монети: ${coinsGot} з ${coinTotal}. Для початку колекції вистачить.`;
  else coinLine = `Монети: 0 з ${coinTotal}. Сайт колекції лишився порожнім. Як і тоді.`;
  let verdict;
  const perfect = candlesGot >= total && coinsGot >= coinTotal;
  if (perfect && falls === 0 && hits === 0 && allergies === 0) verdict = 'Вердикт: ідеальне проходження. Навіть Ісус так не вміє.';
  else if (perfect) verdict = 'Вердикт: зібрано все. Пара синців не рахується.';
  else if (candlesGot >= total * 0.8 && cr >= 0.6) verdict = 'Вердикт: майже все. Для 30 років дуже пристойно.';
  else if (allergies >= 5) verdict = 'Вердикт: дійшов, але полуницю треба обходити. Лікар попереджав.';
  else if (falls + hits >= 15) verdict = 'Вердикт: дійшов. З боями, падіннями і характером. Як у житті.';
  else verdict = 'Вердикт: головне не результат, а те, що дійшов до 30. Але можна і перепройти.';
  ui.stats.innerHTML = `${candleLine}<br>${coinLine}<br>"Номер перенесено": ${portedCount} · падінь: ${falls} · ударів: ${hits} · алергій: ${allergies}<br><span class="verdict">${verdict}</span>`;
  ui.greeting.textContent = '';
  ui.btnAgain.classList.add('hidden');
  ui.finale.classList.add('visible');
  ui.finale.querySelector('.panel').scrollTop = 0;
  confetti = [];
  for (let i = 0; i < 120; i++) confetti.push({ x: Math.random() * W, y: -Math.random() * H, vy: 20 + Math.random() * 40, vx: -10 + Math.random() * 20, c: ['#ffd84a', '#e04a5a', '#3fa7d6', '#52a84a', '#ffb6c1'][i % 5], s: 2 + Math.floor(Math.random() * 2) });
  let i = 0;
  const type = () => {
    if (state !== 'finale') return;
    i += 2;
    ui.greeting.textContent = GREETING.slice(0, i);
    const pnl = ui.greeting.parentElement; pnl.scrollTop = pnl.scrollHeight;
    if (i < GREETING.length) setTimeout(type, 28);
    else { ui.btnAgain.classList.remove('hidden'); const p2 = ui.greeting.parentElement; p2.scrollTop = p2.scrollHeight; }
  };
  setTimeout(type, 600);
}

// ---------- Оновлення ----------
const SPEED = 115, ACC = 900, JUMP = 300, GRAV = 820;

function respawn(reason) {
  const p = player;
  const base = (currentYear() - 1) * SEG;
  p.x = Math.max(base + 40, 40); p.y = GROUND; p.vx = 0; p.vy = 0; p.onGround = true; p.stun = 0.3;
  if (reason === 'fall') { falls++; sfx.fall(); }
}

function update(dt) {
  time += dt;
  if (state === 'start') return;

  if (state === 'play' && currentYear() >= PORTED_FROM_YEAR) {
    nextToast -= dt;
    if (nextToast <= 0 && time > toastBusy) { showPorted(); nextToast = 8 + Math.random() * 8; }
  }

  if (state === 'finale') {
    for (const c of confetti) { c.y += c.vy * dt; c.x += c.vx * dt + Math.sin(time * 3 + c.x) * 0.3; if (c.y > H) { c.y = -5; c.x = Math.random() * W; } }
    return;
  }
  if (state !== 'play') return;

  const p = player;
  if (effect && p.x >= effect.untilX) effect = null;
  const fx = effect ? effect.type : null;
  const am = ageMove(currentYear());
  const speed = SPEED * am.speed * (fx === 'fast' ? 1.5 : fx === 'slow' ? 0.6 : 1);
  const jumpV = JUMP * am.jump * (fx === 'jump' ? 1.3 : fx === 'heavy' ? 0.8 : 1);
  const grav = GRAV * (fx === 'moon' ? 0.45 : 1);
  const PH = playerH(), PW = playerW();

  p.stun = Math.max(0, p.stun - dt);
  const canCtl = p.stun <= 0;
  const left = canCtl && (keys['ArrowLeft'] || keys['KeyA']), right = canCtl && (keys['ArrowRight'] || keys['KeyD']);
  const jump = canCtl && (keys['Space'] || keys['ArrowUp'] || keys['KeyW']);
  const target = (right ? speed : 0) - (left ? speed : 0);
  if (p.vx < target) p.vx = Math.min(target, p.vx + ACC * dt);
  else if (p.vx > target) p.vx = Math.max(target, p.vx - ACC * dt);
  if (target) p.facing = Math.sign(target);
  if (jump && p.onGround) { p.vy = -jumpV; p.onGround = false; sfx.jump(); }
  p.vy += grav * dt;

  // X
  p.x += p.vx * dt;
  if (p.x < 6) p.x = 6;
  for (const o of world.obstacles) {
    if (p.x + PW / 2 > o.x && p.x - PW / 2 < o.x + o.w && p.y > o.y && p.y - PH < o.y + o.h) {
      if (p.vx > 0) p.x = o.x - PW / 2; else if (p.vx < 0) p.x = o.x + o.w + PW / 2;
      if (Math.abs(p.vx) > 60 && bumpT <= 0) { sfx.bump(); bumpT = 0.3; }
      p.vx = 0;
    }
  }
  bumpT -= dt;
  // Y
  p.y += p.vy * dt;
  p.onGround = false;
  const overPit = world.pits.some(pt => p.x - PW / 2 >= pt.x && p.x + PW / 2 <= pt.x + pt.w);
  if (!overPit && p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.onGround = true; }
  for (const o of world.obstacles) {
    if (p.x + PW / 2 > o.x && p.x - PW / 2 < o.x + o.w) {
      if (p.vy >= 0 && p.y > o.y && p.y - p.vy * dt <= o.y + 1) { p.y = o.y; p.vy = 0; p.onGround = true; }
      else if (p.vy < 0 && p.y - PH < o.y + o.h && p.y > o.y + o.h) { p.y = o.y + o.h + PH; p.vy = 0; }
    }
  }
  if (p.y > H + 20) { respawn('fall'); return; }
  if (Math.abs(p.vx) > 5 && p.onGround) p.animT += dt; else p.animT = 0;

  // рухомі небезпеки
  for (const hz of world.hazards) {
    if (hz.eaten || hz.x < p.x - W || hz.x > p.x + W) continue;
    hz.x += hz.dir * hz.speed * dt;
    if (hz.x > hz.x1) { hz.x = hz.x1; hz.dir = -1; } else if (hz.x < hz.x0) { hz.x = hz.x0; hz.dir = 1; }
    if (p.stun <= 0 && p.x + PW / 2 > hz.x && p.x - PW / 2 < hz.x + 10 && p.y > hz.y && p.y - PH < hz.y + 10) {
      if (hz.kind === 'berry') {
        berryTouches++;
        if (berryTouches === 1) { sfx.candle(); showToast('ПОЛУНИЦЯ', 'О, як смачно!', false); hz.eaten = true; continue; }
        if (berryTouches === 2) { sfx.candle(); showToast('ПОЛУНИЦЯ', 'Файно!', false); hz.eaten = true; continue; }
        allergies++; sfx.hit(); showToast('АЛЕРГІЯ', 'Ой, боляче! Полуниця!', false, true);
      } else { hits++; sfx.hit(); }
      p.stun = 0.6; p.vx = -140; p.vy = -160; p.onGround = false;
    }
  }

  // свічки
  for (const c of world.candles) {
    if (!c.got && Math.abs(c.x + 1 - p.x) < 6 + PW / 2 && c.y + 9 > p.y - PH && c.y < p.y) { c.got = true; candlesGot++; sfx.candle(); }
  }
  for (const c of world.coins) {
    if (!c.got && c.x + 5 > p.x - PW / 2 && c.x < p.x + PW / 2 && c.y + 6 > p.y - PH && c.y < p.y) { c.got = true; coinsGot++; sfx.coin(); }
  }
  // сповіщення року
  for (const m of world.yearMarks) {
    if (!m.done && p.x >= m.x) { m.done = true; showYearNotice(m.year); }
  }
  // зупинки
  for (const t of world.triggers) {
    if (!t.done && p.x >= t.x) { t.done = true; openDialog(t.year); break; }
  }
  // фініш
  if (p.x >= FINISH_X) openFinale();
}

// ---------- Малювання ----------
function currentYear() { return Math.min(YEARS, Math.floor(player.x / SEG) + 1); }

function lerpColor(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}

function draw() {
  const year = currentYear();
  const st = ERA_STYLE[era(year)];
  const nextSt = ERA_STYLE[era(Math.min(YEARS, year + 1))];
  const frac = (player.x % SEG) / SEG;
  const mix = frac > 0.85 ? (frac - 0.85) / 0.15 : 0;
  const col = (k) => mix ? lerpColor(st[k], nextSt[k], mix) : st[k];

  const camX = Math.round(Math.max(0, Math.min(player.x - W * 0.35, FINISH_X + 60 - W)));

  // небо
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, mix ? lerpColor(st.sky[0], nextSt.sky[0], mix) : st.sky[0]);
  g.addColorStop(1, mix ? lerpColor(st.sky[1], nextSt.sky[1], mix) : st.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // хмари
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const c of world.clouds) {
    const span = 1400;
    const x = Math.round((((c.x - camX * 0.2) % span) + span) % span) - 60;
    if (x > W) continue;
    ctx.fillRect(x, c.y, c.w, 6); ctx.fillRect(x + 6, c.y - 4, c.w - 12, 4); ctx.fillRect(x + 4, c.y + 6, c.w - 8, 3);
  }

  // пагорби
  ctx.fillStyle = col('hillFar');
  for (let x = 0; x < W; x += 2) { const wx = x + camX * 0.3; const h = 30 + Math.sin(wx / 60) * 12 + Math.sin(wx / 23) * 5; ctx.fillRect(x, GROUND - h, 2, h); }
  ctx.fillStyle = col('hillNear');
  for (let x = 0; x < W; x += 2) { const wx = x + camX * 0.6; const h = 16 + Math.sin(wx / 40 + 2) * 8 + Math.sin(wx / 17) * 3; ctx.fillRect(x, GROUND - h, 2, h); }

  // земля
  ctx.fillStyle = col('ground'); ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = col('grass'); ctx.fillRect(0, GROUND, W, 4);
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  for (let x = -(camX % 16); x < W; x += 16) ctx.fillRect(x, GROUND + 8, 8, 2);

  ctx.save();
  ctx.translate(-camX, 0);

  // ями
  for (const pt of world.pits) {
    if (pt.x + pt.w < camX || pt.x > camX + W) continue;
    const pg = ctx.createLinearGradient(0, GROUND, 0, H);
    pg.addColorStop(0, '#2a1a0e'); pg.addColorStop(1, '#0b0d14');
    ctx.fillStyle = pg; ctx.fillRect(pt.x, GROUND, pt.w, H - GROUND);
    ctx.fillStyle = '#3d2614'; ctx.fillRect(pt.x, GROUND, 2, H - GROUND); ctx.fillRect(pt.x + pt.w - 2, GROUND, 2, H - GROUND);
  }

  // таблички років
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  for (const s of world.signs) {
    if (s.x < camX - 40 || s.x > camX + W + 40) continue;
    const isStop = !!MILESTONES[s.year] || s.year === YEARS;
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(s.x + 7, GROUND - 22, 2, 22);
    ctx.fillStyle = isStop ? '#ffd84a' : '#c98a4b'; ctx.fillRect(s.x, GROUND - 32, 16, 12);
    ctx.fillStyle = '#4a2c17'; ctx.fillRect(s.x, GROUND - 32, 16, 1); ctx.fillRect(s.x, GROUND - 21, 16, 1);
    ctx.fillStyle = '#1a1d2b';
    const txt = String(s.year);
    ctx.fillText(txt, s.x + (txt.length === 1 ? 5 : 1), GROUND - 22);
  }

  // фініш
  {
    const fx = FINISH_X;
    ctx.fillStyle = '#e04a5a'; ctx.fillRect(fx - 2, GROUND - 60, 4, 60); ctx.fillRect(fx + 36, GROUND - 60, 4, 60);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(fx - 2, GROUND - 64, 42, 6);
    ctx.fillStyle = '#1a1d2b'; ctx.fillText('30', fx + 12, GROUND - 58);
    [['#e04a5a', -10, -80], ['#3fa7d6', 46, -84], ['#52a84a', 18, -92]].forEach(([c, ox, oy]) => {
      const by = GROUND + oy + Math.sin(time * 2 + ox) * 2;
      ctx.fillStyle = c; ctx.fillRect(fx + ox, by, 8, 10); ctx.fillRect(fx + ox + 1, by - 1, 6, 12);
      ctx.fillStyle = '#1a1d2b'; ctx.fillRect(fx + ox + 4, by + 12, 1, 8);
    });
  }

  for (const o of world.obstacles) if (o.x + o.w >= camX && o.x <= camX + W) drawObstacle(o, time);
  for (const c of world.candles) if (!c.got && c.x >= camX - 10 && c.x <= camX + W) drawCandle(c.x, c.y + Math.round(Math.sin(time * 4 + c.x) * 1.5), time);
  for (const c of world.coins) if (!c.got && c.x >= camX - 10 && c.x <= camX + W) drawCoin(c.x, c.y, time);
  for (const hz of world.hazards) if (!hz.eaten && hz.x >= camX - 20 && hz.x <= camX + W) drawHazard(hz, time);
  drawPlayer(player, st);
  ctx.restore();

  // HUD
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, 16);
  ctx.fillStyle = '#ffd84a'; ctx.fillText(`РІК ${year}/30`, 6, 12);
  ctx.fillStyle = '#f4f0e6'; ctx.fillText(st.label.toUpperCase(), 100, 12);
  ctx.fillStyle = '#8ee7ff'; ctx.fillText(ageMove(year).label, 215, 12);
  drawCandle(W - 62, 3, time);
  ctx.fillStyle = '#f4f0e6'; ctx.fillText(`${candlesGot}/${YEARS}`, W - 54, 12);
  drawCoin(W - 118, 4, 0);
  ctx.fillStyle = '#f4f0e6'; ctx.fillText(`${coinsGot}/${world.coins.length}`, W - 110, 12);
  ctx.fillStyle = '#5a5f7a'; ctx.fillRect(282, 7, 70, 3);
  ctx.fillStyle = '#ffd84a'; ctx.fillRect(282, 7, Math.round(70 * Math.min(1, player.x / FINISH_X)), 3);

  if (effect && state === 'play') {
    const label = EFFECTS[effect.type].label;
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(W / 2 - tw / 2, 20, tw, 13);
    ctx.fillStyle = '#8ee7ff'; ctx.fillText(label, W / 2 - tw / 2 + 6, 30);
  }

  if (state === 'finale') {
    for (const c of confetti) { ctx.fillStyle = c.c; ctx.fillRect(Math.round(c.x), Math.round(c.y), c.s, c.s); }
  }
  if (state === 'play' && player.x < 120 && time < 20) {
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(W / 2 - 70, 36, 140, 14);
    ctx.fillStyle = '#f4f0e6'; ctx.fillText('БІЖИ ПРАВОРУЧ →', W / 2 - 64, 46);
  }
}

// ---------- Цикл ----------
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

reset();
window.__dima = { get player() { return player; }, get world() { return world; }, get effect() { return effect; }, finale: openFinale, ported: showPorted, notice: showNotice, setX: (x) => { player.x = x; }, setEffect: (t) => { effect = { type: t, untilX: 1e9 }; } };
document.fonts && document.fonts.ready.then(() => draw());
requestAnimationFrame(loop);
})();
