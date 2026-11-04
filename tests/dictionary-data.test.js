// Целостность data/dictionary.json и эталонные формы неправильных глаголов.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareEntries } from '../js/dictionary.js';
import { entryMeta, verbType } from '../js/format.js';

const raw = JSON.parse(readFileSync(new URL('../data/dictionary.json', import.meta.url), 'utf8'));
const entries = prepareEntries(raw);
const find = (word, pos) => entries.find((e) => e.word === word && (!pos || e.pos === pos));

const POS = new Set(['noun', 'verb', 'adj', 'adv', 'prep', 'pron', 'conj', 'interj', 'num', 'det', 'phrase']);
const FORM_KEYS = {
  verb: new Set(['past', 'participle', 'ing', 'third']),
  noun: new Set(['plural']),
  adj: new Set(['comparative', 'superlative']),
  adv: new Set(['comparative', 'superlative']),
};

describe('структура словаря', () => {
  test('у каждой статьи есть слово, известная часть речи и переводы', () => {
    for (const e of raw) {
      assert.ok(e.word?.trim(), JSON.stringify(e));
      assert.ok(POS.has(e.pos), `${e.word}: часть речи ${e.pos}`);
      assert.ok(Array.isArray(e.translations) && e.translations.length, `${e.word}: нет переводов`);
      assert.ok(e.translations.every((t) => t.trim()), `${e.word}: пустой перевод`);
    }
  });

  test('нет повторов слова с той же частью речи', () => {
    const seen = new Set();
    for (const e of raw) {
      const key = `${e.word}|${e.pos}`;
      assert.ok(!seen.has(key), `повтор: ${key}`);
      seen.add(key);
    }
  });

  test('forms только с допустимыми ключами для части речи', () => {
    for (const e of raw.filter((e) => e.forms)) {
      const allowed = FORM_KEYS[e.pos];
      assert.ok(allowed, `${e.word}: forms у ${e.pos}`);
      for (const [key, value] of Object.entries(e.forms)) {
        assert.ok(allowed.has(key), `${e.word}: ключ ${key}`);
        assert.ok(typeof value === 'string' && value.trim(), `${e.word}: ${key}`);
      }
    }
  });

  test('у каждого глагола все четыре формы', () => {
    for (const e of entries.filter((e) => e.pos === 'verb')) {
      for (const key of ['past', 'participle', 'ing', 'third']) {
        assert.ok(e.inflected[key]?.trim(), `${e.word}: ${key}`);
      }
    }
  });

  test('примеры заполнены с обеих сторон', () => {
    for (const e of raw.filter((e) => e.examples)) {
      for (const ex of e.examples) assert.ok(ex.en?.trim() && ex.ru?.trim(), e.word);
    }
  });
});

describe('отметка правильный / неправильный', () => {
  test('глаголы', () => {
    for (const w of ['be', 'go', 'have', 'buy', 'learn', 'get up']) assert.equal(verbType(find(w, 'verb')), 'неправильный', w);
    for (const w of ['work', 'play', 'study', 'look for']) assert.equal(verbType(find(w, 'verb')), 'правильный', w);
  });

  test('подписи статей', () => {
    assert.equal(verbType(find('house')), null);
    assert.equal(entryMeta(find('go', 'verb')), 'гл., неправильный');
    assert.equal(entryMeta(find('child', 'noun')), 'сущ., мн. ч. children');
    assert.equal(entryMeta(find('house', 'noun')), 'сущ.');
  });
});

// Эталонные формы по британским грамматикам.
describe('эталонные формы', () => {
  const reference = {
    be: { past: 'was/were', participle: 'been', third: 'is', ing: 'being' },
    have: { past: 'had', participle: 'had', third: 'has' },
    do: { past: 'did', participle: 'done', third: 'does' },
    go: { past: 'went', participle: 'gone', third: 'goes' },
    get: { past: 'got', participle: 'got', ing: 'getting' },
    begin: { past: 'began', participle: 'begun', ing: 'beginning' },
    write: { past: 'wrote', participle: 'written', ing: 'writing' },
    swim: { past: 'swam', participle: 'swum', ing: 'swimming' },
    lie: { past: 'lay', participle: 'lain', ing: 'lying' },
    learn: { past: 'learnt/learned', participle: 'learnt/learned' },
    show: { past: 'showed', participle: 'shown' },
    travel: { past: 'travelled', ing: 'travelling' },
    prefer: { past: 'preferred' },
    visit: { past: 'visited' },
    'get up': { past: 'got up', ing: 'getting up' },
  };

  for (const [word, expected] of Object.entries(reference)) {
    for (const [key, value] of Object.entries(expected)) {
      test(`${word}: ${key}`, () => assert.equal(find(word, 'verb').inflected[key], value));
    }
  }

  test('множественное число и степени сравнения', () => {
    assert.equal(find('tooth', 'noun').forms.plural, 'teeth');
    assert.equal(find('mouse', 'noun').forms.plural, 'mice');
    assert.deepEqual(find('good', 'adj').forms, { comparative: 'better', superlative: 'best' });
  });
});
