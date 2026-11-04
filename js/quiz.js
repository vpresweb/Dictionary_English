// Тест на формы глаголов: показывается глагол и форма (Past Simple, Past Participle…) —
// пользователь вводит её. Логика вопросов и проверки ответов вынесена в чистые функции
// (их покрывают автотесты), initQuiz подключает её к странице.
import { VERB_FORMS, variants, isIrregular as isIrregularVerb } from './verbs.js';
import { escapeHtml } from './format.js';
import { speak } from './speech.js';

export const QUIZ_FORMS = VERB_FORMS;

const SETTINGS_KEY = 'dictionary.quiz.settings';
const DEFAULT_SETTINGS = { forms: ['past', 'participle'], set: 'irregular', phrasal: false };

export function isIrregular(entry) {
  return isIrregularVerb(entry.forms);
}

// phrasal — включать ли фразовые глаголы (get up, look for).
export function filterVerbs(entries, set, phrasal = false) {
  const verbs = entries.filter((e) => e.pos === 'verb' && (phrasal || !e.word.includes(' ')));
  if (set === 'irregular') return verbs.filter(isIrregular);
  if (set === 'regular') return verbs.filter((e) => !isIrregular(e));
  return verbs;
}

// Возвращает { entry, form, answer } или null, если выбирать не из чего.
export function makeQuestion(verbs, { forms }, random = Math.random) {
  const pickFrom = (list) => list[Math.floor(random() * list.length)];
  const enabled = QUIZ_FORMS.filter((f) => forms.includes(f.key));
  if (!verbs.length || !enabled.length) return null;

  const entry = pickFrom(verbs);
  const form = pickFrom(enabled);
  return { entry, form, answer: entry.inflected[form.key] };
}

// 'correct' — совпадает с одним из вариантов (learnt / learned), 'wrong' — нет.
// Ответ можно дать и всеми вариантами через «/» или запятую.
export function checkAnswer(expected, given) {
  const clean = (s) => s.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
  const allowed = variants(expected).map(clean);
  const parts = given.split(/[/,]/).map(clean).filter(Boolean);
  if (!parts.length) return 'wrong';
  return parts.every((p) => allowed.includes(p)) ? 'correct' : 'wrong';
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Хранилище недоступно — настройки действуют до перезагрузки.
  }
}

export function initQuiz(entries, root) {
  const formsBox = root.querySelector('#quiz-forms');
  const setSelect = root.querySelector('#quiz-set');
  const phrasalToggle = root.querySelector('#quiz-phrasal');
  const questionBox = root.querySelector('#quiz-question');
  const form = root.querySelector('#quiz-form');
  const input = root.querySelector('#quiz-input');
  const revealButton = root.querySelector('#quiz-reveal');
  const submitButton = root.querySelector('#quiz-submit');
  const feedback = root.querySelector('#quiz-feedback');
  const scoreLine = root.querySelector('#quiz-score');
  const resetButton = root.querySelector('#quiz-reset');

  const settings = loadSettings();
  const score = { correct: 0, total: 0, streak: 0 };
  let question = null;
  let answered = false;

  formsBox.innerHTML = QUIZ_FORMS.map(({ key, label, ru }) => `
    <label class="checkbox" title="${ru}">
      <input type="checkbox" value="${key}" ${settings.forms.includes(key) ? 'checked' : ''}>
      <span lang="en">${label}</span>
    </label>`).join('');
  setSelect.value = settings.set;
  phrasalToggle.checked = settings.phrasal;

  function renderScore() {
    const percent = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    scoreLine.textContent = score.total
      ? `Верно ${score.correct} из ${score.total} (${percent}%) · серия ${score.streak}`
      : 'Ответьте на первый вопрос';
  }

  function next() {
    question = makeQuestion(filterVerbs(entries, settings.set, settings.phrasal), settings);
    answered = false;
    feedback.className = 'quiz-feedback';
    feedback.innerHTML = '';
    input.value = '';
    input.enterKeyHint = 'done';
    submitButton.textContent = 'Проверить';
    revealButton.disabled = false;

    if (!question) {
      questionBox.innerHTML = '<p class="quiz-empty">Выберите хотя бы одну форму в настройках теста.</p>';
      input.disabled = submitButton.disabled = revealButton.disabled = true;
      return;
    }
    input.disabled = submitButton.disabled = false;

    const { entry, form: verbForm } = question;
    questionBox.innerHTML = `
      <span class="quiz-verb speak" lang="en" title="Прослушать">${escapeHtml(entry.word)}</span>
      <span class="quiz-translation">${escapeHtml(entry.translations.join(', '))}</span>
      <span class="quiz-tags">
        <span class="quiz-tag quiz-person" lang="en" title="${verbForm.ru}">${verbForm.label}</span>
      </span>`;
    input.focus();
  }

  function finish(result) {
    answered = true;
    score.total += 1;
    if (result === 'wrong') score.streak = 0;
    else {
      score.correct += 1;
      score.streak += 1;
    }

    const shown = variants(question.answer).join(' / ');
    const answer = `<b class="speak" lang="en">${escapeHtml(shown)}</b>`;
    const all = `<a href="?q=${encodeURIComponent(question.entry.word)}">все формы</a>`;
    const messages = {
      correct: `Верно! ${answer}`,
      wrong: `Неверно. Правильно: ${answer} · ${all}`,
    };
    feedback.className = `quiz-feedback ${result}`;
    feedback.innerHTML = messages[result];
    // Поле остаётся в фокусе и доступным, чтобы на телефоне не закрывалась клавиатура:
    // Enter переходит дальше, а начало ввода сразу открывает следующий вопрос.
    input.enterKeyHint = 'next';
    submitButton.textContent = 'Дальше →';
    revealButton.disabled = true;
    renderScore();
    speak(variants(question.answer).join(', '), feedback.querySelector('.speak'));
    input.focus();
  }

  input.addEventListener('beforeinput', () => {
    if (answered) next();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!question) return;
    if (answered) {
      next();
      return;
    }
    if (!input.value.trim()) {
      input.focus();
      return;
    }
    finish(checkAnswer(question.answer, input.value));
  });

  revealButton.addEventListener('click', () => {
    if (question && !answered) finish('wrong');
  });

  function updateSettings() {
    settings.forms = [...formsBox.querySelectorAll('input:checked')].map((i) => i.value);
    settings.set = setSelect.value;
    settings.phrasal = phrasalToggle.checked;
    saveSettings(settings);
    next();
  }
  formsBox.addEventListener('change', updateSettings);
  setSelect.addEventListener('change', updateSettings);
  phrasalToggle.addEventListener('change', updateSettings);

  resetButton.addEventListener('click', () => {
    Object.assign(score, { correct: 0, total: 0, streak: 0 });
    renderScore();
    next();
  });

  renderScore();
  next();
}
