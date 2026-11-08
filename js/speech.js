// Озвучивание английского текста через Web Speech API браузера.
// Любой элемент с классом .speak озвучивается по нажатию (делегирование на document),
// элементы с tabindex — ещё и по Enter.

const PREFERRED_LANGS = ['en-gb', 'en-us'];

// Если фраза не начала звучать за это время, синтезатор считается зависшим.
// Сетевым голосам (Google …) нужно больше: первый запрос к серверу идёт 2–4 секунды.
const START_TIMEOUT_LOCAL = 2000;
const START_TIMEOUT_NETWORK = 5000;
// Chrome молча теряет фразу, отправленную сразу после cancel() (проверено с голосами Google):
// новая фраза уходит с небольшой паузой.
const CANCEL_GAP = 120;

let voice = null;
// Текущая фраза: { text, started, ended }. Ссылка на неё ещё и не даёт сборщику мусора
// удалить utterance — иначе Chrome не присылает end и считает, что речь продолжается.
let active = null;
let pendingTimer = null;

const supported = () => 'speechSynthesis' in window;
const langOf = (v) => v.lang.replace('_', '-').toLowerCase();

// Локальный голос надёжнее сетевого: отвечает сразу и без интернета.
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const candidates = [...PREFERRED_LANGS.map((lang) => (v) => langOf(v) === lang), (v) => langOf(v).startsWith('en')];
  for (const local of [true, false]) {
    for (const matches of candidates) {
      const found = voices.find((v) => matches(v) && Boolean(v.localService) === local);
      if (found) return found;
    }
  }
  return null;
}

// Если синтезатор занят, прерываем его и отправляем фразу после паузы CANCEL_GAP.
// При быстрых нажатиях прозвучит последняя фраза.
function cancelThen(run) {
  clearTimeout(pendingTimer);
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    pendingTimer = setTimeout(run, CANCEL_GAP);
  } else {
    run();
  }
}

// retry — повторная попытка после сбоя: сетевые голоса Chrome (Google …) иногда молча
// не отвечают, тогда синтезатор сбрасывается и фраза отправляется ещё раз.
export function speak(text, element, retry = false) {
  if (!supported() || !text) return;
  voice ??= pickVoice();
  // Тот же текст, который уже звучит, просто дозвучивает. Флаг speaking может «залипнуть»
  // после сбоя, поэтому смотрим на события самой фразы, а не только на него.
  if (active && active.text === text && active.started && !active.ended && speechSynthesis.speaking) return;
  cancelThen(() => say(text, element, retry));
}

function say(text, element, retry) {
  // resume() снимает «залипшую» паузу синтезатора после простоя.
  speechSynthesis.resume();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? 'en-GB';
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;

  const state = { text, element, utterance, started: false, ended: false };
  active = state;
  if (element) element.classList.add('speaking');
  const finish = () => {
    state.ended = true;
    // Подсветку не снимаем, если тот же элемент уже озвучивается новой фразой.
    if (element && (active === state || active.element !== element)) element.classList.remove('speaking');
  };
  const again = () => {
    if (retry || active !== state) return;
    active = null;
    clearTimeout(pendingTimer);
    speechSynthesis.cancel();
    pendingTimer = setTimeout(() => say(text, element, true), CANCEL_GAP);
  };

  utterance.addEventListener('start', () => { state.started = true; });
  utterance.addEventListener('end', finish);
  utterance.addEventListener('error', (event) => {
    finish();
    // interrupted и canceled — это наш собственный cancel(), а не сбой.
    if (event.error !== 'interrupted' && event.error !== 'canceled') again();
  });
  setTimeout(() => {
    if (state.started || state.ended) return;
    finish();
    again();
  }, voice && !voice.localService ? START_TIMEOUT_NETWORK : START_TIMEOUT_LOCAL);

  speechSynthesis.speak(utterance);
}

// Варианты формы (learnt / learned) читаются через запятую.
function speakElement(element) {
  speak((element.dataset.speak ?? element.textContent.trim()).replace(/\s*\/\s*/g, ', '), element);
}

// note — элемент, который показывается, если в системе нет английского голоса.
export function initSpeech(note) {
  if (!supported()) {
    document.documentElement.classList.add('no-speech');
    if (note) {
      note.textContent = 'Браузер не поддерживает озвучивание.';
      note.hidden = false;
    }
    return;
  }

  // Список голосов в Chrome приходит асинхронно, поэтому проверяем и сразу, и по событию.
  const checkVoices = () => {
    if (!speechSynthesis.getVoices().length) return;
    voice = pickVoice();
    if (note) note.hidden = Boolean(voice);
  };
  checkVoices();
  speechSynthesis.addEventListener('voiceschanged', checkVoices);

  // Синтезатор запускается не мгновенно, поэтому при первом действии пользователя
  // (речь разрешена только после него) прогреваем его беззвучной фразой.
  let warmed = false;
  const warmUp = () => {
    if (warmed) return;
    warmed = true;
    const utterance = new SpeechSynthesisUtterance(' ');
    utterance.volume = 0;
    speechSynthesis.speak(utterance);
  };

  // Мышью озвучиваем уже при нажатии кнопки, не дожидаясь отпускания;
  // касание и клавиатура идут через click, чтобы прокрутка пальцем ничего не озвучивала.
  let pressed = null;
  document.addEventListener('pointerdown', (event) => {
    const element = event.target.closest('.speak');
    if (event.pointerType !== 'mouse' || event.button !== 0 || !element) {
      // Не на кнопках: карточка озвучивает слово сама, и прогрев прервал бы его.
      if (!element && !event.target.closest('button')) warmUp();
      return;
    }
    warmed = true;
    pressed = element;
    speakElement(element);
  });

  document.addEventListener('click', (event) => {
    const element = event.target.closest('.speak');
    if (element && element !== pressed) speakElement(element);
    pressed = null;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      warmUp();
      return;
    }
    const element = event.target.closest('.speak[tabindex]');
    if (element) speakElement(element);
  });
}
