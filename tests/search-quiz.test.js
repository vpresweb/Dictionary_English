// Поиск по словарю и логика теста на формы глаголов.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editDistance, normalize, prepareEntries, search, suggest } from '../js/dictionary.js';
import { checkAnswer, filterVerbs, isIrregular, makeQuestion, QUIZ_FORMS } from '../js/quiz.js';

const entries = prepareEntries(JSON.parse(readFileSync(new URL('../data/dictionary.json', import.meta.url), 'utf8')));
const words = (query, mode) => search(entries, query, mode).map((e) => e.word);

describe('поиск', () => {
  test('normalize убирает регистр, диакритику, ё и типографский апостроф', () => {
    assert.equal(normalize('  Café '), 'cafe');
    assert.equal(normalize('Ёлка'), 'елка');
    assert.equal(normalize('I’m'), "i'm");
  });

  test('точное совпадение идёт первым', () => {
    assert.equal(words('HOUSE')[0], 'house');
    assert.equal(words('cafe')[0], 'café');
  });

  test('приставка to у глагола не мешает', () => {
    assert.equal(words('to go')[0], 'go');
  });

  test('поиск по формам', () => {
    assert.equal(words('went')[0], 'go');
    assert.equal(words('children')[0], 'child');
    assert.ok(words('better').includes('good'));
    assert.equal(words('was')[0], 'be');
  });

  test('направления RU → EN и EN → RU', () => {
    assert.ok(words('собака', 'ru').includes('dog'));
    assert.deepEqual(words('собака', 'en'), []);
  });

  test('пустой запрос ничего не находит', () => {
    assert.deepEqual(words('   '), []);
  });
});

describe('подсказки при опечатке', () => {
  const hints = (query, mode) => suggest(entries, query, mode).map((h) => h.text);

  test('editDistance: замена, вставка, удаление, перестановка', () => {
    assert.equal(editDistance('frend', 'friend'), 1);
    assert.equal(editDistance('hosue', 'house'), 1);
    assert.equal(editDistance('cat', 'cat'), 0);
    assert.equal(editDistance('cat', 'elephant', 2), 3);
  });

  test('форма глагола с опечаткой', () => {
    assert.deepEqual(words('brougth'), []);
    assert.ok(suggest(entries, 'brougth').some((h) => h.text === 'brought' && h.entry.word === 'bring'));
  });

  test('слово и перевод с опечаткой', () => {
    assert.ok(hints('beautifull').includes('beautiful'));
    assert.ok(hints('сабака', 'ru').includes('собака'));
    assert.ok(!hints('сабака', 'en').includes('собака'));
  });

  test('короткие запросы и далёкие слова не подсказываются', () => {
    assert.deepEqual(hints('xz'), []);
    assert.deepEqual(hints('qqqqqqq'), []);
  });
});

describe('тест на формы глаголов', () => {
  test('checkAnswer: варианты, регистр, пробелы', () => {
    assert.equal(checkAnswer('went', 'went'), 'correct');
    assert.equal(checkAnswer('went', '  Went '), 'correct');
    assert.equal(checkAnswer('learnt/learned', 'learned'), 'correct');
    assert.equal(checkAnswer('learnt/learned', 'learnt / learned'), 'correct');
    assert.equal(checkAnswer('was/were', 'were, was'), 'correct');
    assert.equal(checkAnswer('went', 'goed'), 'wrong');
    assert.equal(checkAnswer('learnt/learned', 'learned, learnd'), 'wrong');
    assert.equal(checkAnswer('went', ''), 'wrong');
  });

  test('isIrregular и filterVerbs', () => {
    const go = entries.find((e) => e.word === 'go' && e.pos === 'verb');
    const work = entries.find((e) => e.word === 'work' && e.pos === 'verb');
    assert.ok(isIrregular(go));
    assert.ok(!isIrregular(work));

    const all = filterVerbs(entries, 'all');
    const irregular = filterVerbs(entries, 'irregular');
    const regular = filterVerbs(entries, 'regular');
    assert.ok(all.every((e) => e.pos === 'verb' && !e.word.includes(' ')));
    assert.equal(irregular.length + regular.length, all.length);
    assert.ok(irregular.includes(go) && regular.includes(work));
    assert.ok(filterVerbs(entries, 'all', true).some((e) => e.word === 'get up'));
  });

  test('makeQuestion: ответ совпадает с формами статьи', () => {
    const verbs = filterVerbs(entries, 'all', true);
    const forms = QUIZ_FORMS.map((f) => f.key);
    for (let i = 0; i < 500; i++) {
      const q = makeQuestion(verbs, { forms });
      assert.equal(q.answer, q.entry.inflected[q.form.key]);
      assert.ok(forms.includes(q.form.key));
    }
  });

  test('makeQuestion учитывает выбранные формы', () => {
    const verbs = filterVerbs(entries, 'irregular');
    for (let i = 0; i < 100; i++) assert.equal(makeQuestion(verbs, { forms: ['participle'] }).form.key, 'participle');
  });

  test('makeQuestion возвращает null без форм или глаголов', () => {
    assert.equal(makeQuestion(filterVerbs(entries, 'all'), { forms: [] }), null);
    assert.equal(makeQuestion([], { forms: ['past'] }), null);
  });

  test('makeQuestion детерминирован при заданном random', () => {
    const verbs = filterVerbs(entries, 'irregular');
    const q = makeQuestion(verbs, { forms: ['past', 'participle'] }, () => 0);
    assert.equal(q.entry, verbs[0]);
    assert.equal(q.form.key, 'past');
    assert.equal(q.answer, verbs[0].inflected.past);
  });
});
