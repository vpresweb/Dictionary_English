// Режим карточек: слово → перевод, оценка «знаю / не знаю», прогресс в localStorage.
// Интервальное повторение по системе Лейтнера: 5 коробок, слова из младших коробок
// выпадают чаще; «знаю» переносит слово в следующую коробку, «не знаю» — в первую.
import { escapeHtml, entryMeta } from './format.js';
import { speak } from './speech.js';

const STORAGE_KEY = 'dictionary.cards.v1';
const AUTOSPEAK_KEY = 'dictionary.cards.autospeak';
const BOX_WEIGHTS = [16, 8, 4, 2, 1];
const LEARNED_BOX = 3;
const OTHER_POS = new Set(['adv', 'prep', 'pron', 'conj', 'interj', 'num', 'det', 'phrase']);

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Хранилище недоступно (приватный режим) — прогресс живёт до перезагрузки.
  }
}

function loadAutospeak() {
  try {
    return localStorage.getItem(AUTOSPEAK_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveAutospeak(enabled) {
  try {
    localStorage.setItem(AUTOSPEAK_KEY, enabled ? 'on' : 'off');
  } catch {
    // Хранилище недоступно — настройка действует до перезагрузки.
  }
}

function matchesFilter(entry, filter) {
  if (filter === 'all') return true;
  if (filter === 'other') return OTHER_POS.has(entry.pos);
  return entry.pos === filter;
}

export function initCards(entries, root) {
  const card = root.querySelector('#card');
  const front = root.querySelector('#card-front');
  const back = root.querySelector('#card-back');
  const hint = root.querySelector('#card-hint');
  const knownButton = root.querySelector('#card-known');
  const unknownButton = root.querySelector('#card-unknown');
  const directionSelect = root.querySelector('#cards-direction');
  const filterSelect = root.querySelector('#cards-filter');
  const stats = root.querySelector('#cards-stats');
  const resetButton = root.querySelector('#cards-reset');
  const autospeakToggle = root.querySelector('#cards-autospeak');

  const progress = loadProgress();
  autospeakToggle.checked = loadAutospeak();
  let current = null;
  let flipped = false;
  let resetArmed = null;

  // Ключ — слово и часть речи: у омонимов (work — глагол и существительное) прогресс раздельный.
  const id = (entry) => `${entry.word}|${entry.pos}`;
  const box = (entry) => progress[id(entry)] ?? 0;
  const pool = () => entries.filter((e) => matchesFilter(e, filterSelect.value));

  function pick() {
    const candidates = pool().filter((e) => e !== current);
    if (!candidates.length) return pool()[0] ?? null;
    const total = candidates.reduce((sum, e) => sum + BOX_WEIGHTS[box(e)], 0);
    let r = Math.random() * total;
    for (const e of candidates) {
      r -= BOX_WEIGHTS[box(e)];
      if (r < 0) return e;
    }
    return candidates[candidates.length - 1];
  }

  function renderStats() {
    const words = pool();
    const learned = words.filter((e) => box(e) >= LEARNED_BOX).length;
    const seen = words.filter((e) => id(e) in progress).length;
    stats.textContent = `Выучено ${learned} из ${words.length} · просмотрено ${seen}`;
  }

  function render() {
    flipped = false;
    card.classList.remove('flipped');
    knownButton.disabled = unknownButton.disabled = !current;
    hint.hidden = false;

    if (!current) {
      front.textContent = 'Нет слов для выбранного фильтра';
      back.innerHTML = '';
      return;
    }

    const enToRu = directionSelect.value === 'en';
    const word = `<span class="speak" lang="en" data-word title="Прослушать">${escapeHtml(current.word)}</span>`;
    const translation = escapeHtml(current.translations.join(', '));
    const meta = entryMeta(current);
    const example = current.examples?.[0];

    front.innerHTML = enToRu ? word : translation;
    back.innerHTML = `
      <span class="card-answer">${enToRu ? translation : word}</span>
      ${meta ? `<span class="card-meta">${escapeHtml(meta)}</span>` : ''}
      ${example ? `<span class="card-example"><span class="speak" lang="en">${escapeHtml(example.en)}</span> — ${escapeHtml(example.ru)}</span>` : ''}`;
  }

  function next() {
    current = pick();
    render();
    renderStats();
  }

  function speakWord() {
    speak(current.word, card.querySelector('.speak[data-word]'));
  }

  function flip() {
    if (!current || flipped) return;
    flipped = true;
    card.classList.add('flipped');
    hint.hidden = true;
    if (autospeakToggle.checked) speakWord();
  }

  // Клик по карточке переворачивает её и всегда произносит слово, в том числе повторно.
  // Если кликнули по самому слову, его уже озвучил обработчик из speech.js.
  function onCardClick(event) {
    if (!current) return;
    const onWord = event.target.closest('.speak');
    if (!flipped) {
      flipped = true;
      card.classList.add('flipped');
      hint.hidden = true;
    }
    if (!onWord) speakWord();
  }

  function answer(known) {
    if (!current) return;
    progress[id(current)] = known ? Math.min(box(current) + 1, BOX_WEIGHTS.length - 1) : 0;
    saveProgress(progress);
    next();
  }

  card.addEventListener('click', onCardClick);
  knownButton.addEventListener('click', () => answer(true));
  unknownButton.addEventListener('click', () => answer(false));
  directionSelect.addEventListener('change', render);
  filterSelect.addEventListener('change', next);
  autospeakToggle.addEventListener('change', () => saveAutospeak(autospeakToggle.checked));

  // Сброс в два нажатия вместо confirm().
  resetButton.addEventListener('click', () => {
    if (!resetArmed) {
      resetButton.textContent = 'Нажмите ещё раз, чтобы сбросить';
      resetArmed = setTimeout(() => {
        resetArmed = null;
        resetButton.textContent = 'Сбросить прогресс';
      }, 3000);
      return;
    }
    clearTimeout(resetArmed);
    resetArmed = null;
    resetButton.textContent = 'Сбросить прогресс';
    for (const key of Object.keys(progress)) delete progress[key];
    saveProgress(progress);
    next();
  });

  // Клавиши: пробел — перевернуть, → — знаю, ← — не знаю.
  document.addEventListener('keydown', (event) => {
    if (root.hidden || event.target.closest('select, input, textarea')) return;
    // Пробел на кнопке нажимает её саму, поэтому перехватываем только вне кнопок.
    if (event.key === ' ' && !event.target.closest('button')) {
      event.preventDefault();
      flip();
    } else if (event.key === 'ArrowRight') {
      answer(true);
    } else if (event.key === 'ArrowLeft') {
      answer(false);
    }
  });

  next();
}
