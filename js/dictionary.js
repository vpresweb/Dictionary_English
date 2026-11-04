// Загрузка словаря и поиск по нему.
import { verbForms, allForms } from './verbs.js';

// Приводит строку к виду для сравнения: нижний регистр, без диакритики (café → cafe, ё → е),
// апостроф ’ как обычный.
export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[‘’]/g, "'")
    .trim();
}

// Формы статьи для вывода и поиска: у глаголов — все четыре, у остальных — только заданные
// в словаре (неправильное множественное число, степени сравнения).
export function entryForms(entry) {
  if (entry.pos === 'verb') return verbForms(entry.word, entry.forms, entry.double);
  return entry.forms ?? null;
}

export function prepareEntries(entries) {
  return entries.map((entry) => {
    const forms = entryForms(entry);
    return {
      ...entry,
      inflected: forms,
      _en: normalize(entry.word),
      _ru: entry.translations.map(normalize),
      _forms: forms ? [...new Set(allForms(forms).map(normalize))] : [],
    };
  });
}

export async function loadDictionary(url = 'data/dictionary.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Не удалось загрузить словарь: ${response.status}`);
  return prepareEntries(await response.json());
}

// Ранг совпадения: 0 — точное, 1 — начало слова, 2 — подстрока, null — нет совпадения.
function rank(candidate, query) {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;
  return null;
}

function bestRank(candidates, query) {
  let best = null;
  for (const candidate of candidates) {
    const r = rank(candidate, query);
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}

// mode: 'all' | 'en' | 'ru'
export function search(entries, rawQuery, mode = 'all', limit = 50) {
  const query = normalize(rawQuery).replace(/^to\s+/, '');
  if (!query) return [];

  const found = [];
  for (const entry of entries) {
    const ranks = [];
    if (mode !== 'ru') {
      ranks.push(rank(entry._en, query));
      // Точное совпадение с формой (went → go) ставим сразу после точного совпадения слова.
      if (entry._forms.includes(query)) ranks.push(0.5);
    }
    if (mode !== 'en') ranks.push(bestRank(entry._ru, query));
    const valid = ranks.filter((r) => r !== null);
    if (valid.length) found.push({ entry, score: Math.min(...valid) });
  }

  found.sort((a, b) => a.score - b.score || a.entry.word.localeCompare(b.entry.word, 'en'));
  return found.slice(0, limit).map((f) => f.entry);
}

// Расстояние Дамерау — Левенштейна (вставка, удаление, замена, перестановка соседних букв).
// Возвращает max + 1, как только расстояние заведомо больше max.
// Три строки матрицы переиспользуются между вызовами: подсказки считают десятки тысяч расстояний.
let rows = [new Int32Array(64), new Int32Array(64), new Int32Array(64)];

export function editDistance(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (b.length + 1 > rows[0].length) rows = rows.map(() => new Int32Array(b.length + 1));
  let [prev2, prev, cur] = rows;
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[b.length];
}

// Подсказки при опечатке: слова, формы и переводы, отличающиеся на 1–2 буквы.
// Возвращает [{ text, entry }], text — что подставить в поиск.
// Кандидаты для подсказок строятся один раз на словарь: { text, norm, entry, lang }.
const hintCandidates = new WeakMap();

function candidatesFor(entries) {
  let list = hintCandidates.get(entries);
  if (list) return list;
  list = [];
  const seen = new Set();
  const add = (text, norm, entry, lang) => {
    const key = `${lang}|${norm}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ text, norm, entry, lang });
  };
  // Сначала все слова, потом формы: если написание совпадает, остаётся слово.
  for (const entry of entries) add(entry.word, entry._en, entry, 'en');
  for (const entry of entries) {
    if (entry.inflected) for (const form of allForms(entry.inflected)) add(form, normalize(form), entry, 'en');
    entry.translations.forEach((t, i) => add(t, entry._ru[i], entry, 'ru'));
  }
  hintCandidates.set(entries, list);
  return list;
}

export function suggest(entries, rawQuery, mode = 'all', limit = 5) {
  const query = normalize(rawQuery);
  if (query.length < 3) return [];
  const max = query.length <= 5 ? 1 : 2;
  const best = new Map();

  for (const c of candidatesFor(entries)) {
    if ((mode === 'en' && c.lang === 'ru') || (mode === 'ru' && c.lang === 'en')) continue;
    if (Math.abs(c.norm.length - query.length) > max) continue;
    const d = editDistance(c.norm, query, max);
    if (d > max) continue;
    const known = best.get(c.norm);
    if (!known || d < known.d) best.set(c.norm, { text: c.text, entry: c.entry, d });
  }

  return [...best.values()]
    .sort((a, b) => a.d - b.d || a.text.localeCompare(b.text, 'en'))
    .slice(0, limit)
    .map(({ text, entry }) => ({ text, entry }));
}
