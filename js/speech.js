// Озвучивание английского текста через Web Speech API браузера.
// Любой элемент с классом .speak озвучивается по нажатию (делегирование на document),
// элементы с tabindex — ещё и по Enter.

const PREFERRED_LANGS = ['en-gb', 'en-us'];

let voice = null;
let current = null;

const supported = () => 'speechSynthesis' in window;
const langOf = (v) => v.lang.replace('_', '-').toLowerCase();

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  for (const lang of PREFERRED_LANGS) {
    const found = voices.find((v) => langOf(v) === lang);
    if (found) return found;
  }
  return voices.find((v) => langOf(v).startsWith('en')) ?? null;
}

export function speak(text, element) {
  if (!supported() || !text) return;
  voice ??= pickVoice();
  // cancel() в Chrome задерживает следующую фразу почти на секунду, поэтому вызываем его только
  // если звучит другой текст; тот же текст просто дозвучивает.
  // resume() снимает «залипшую» паузу синтезатора после простоя.
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    if (text === current) return;
    speechSynthesis.cancel();
  }
  speechSynthesis.resume();
  current = text;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? 'en-GB';
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;

  if (element) {
    element.classList.add('speaking');
    const done = () => element.classList.remove('speaking');
    utterance.addEventListener('end', done);
    utterance.addEventListener('error', done);
  }
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
