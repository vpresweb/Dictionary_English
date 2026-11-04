// Генератор форм английских глаголов.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { verbForms, doublesFinal, isIrregular, variants, allForms } from '../js/verbs.js';

const forms = (word, overrides, double) => verbForms(word, overrides, double);

describe('правильные глаголы', () => {
  test('обычное окончание', () => {
    assert.deepEqual(forms('work'), { past: 'worked', participle: 'worked', ing: 'working', third: 'works' });
    assert.deepEqual(forms('play'), { past: 'played', participle: 'played', ing: 'playing', third: 'plays' });
  });

  test('немая e', () => {
    assert.deepEqual(forms('live'), { past: 'lived', participle: 'lived', ing: 'living', third: 'lives' });
    assert.equal(forms('agree').ing, 'agreeing');
    assert.equal(forms('argue').ing, 'arguing');
    assert.equal(forms('die').ing, 'dying');
    assert.equal(forms('tie').past, 'tied');
  });

  test('согласная + y', () => {
    assert.deepEqual(forms('study'), { past: 'studied', participle: 'studied', ing: 'studying', third: 'studies' });
    assert.equal(forms('try').third, 'tries');
    assert.equal(forms('enjoy').past, 'enjoyed');
  });

  test('-es в третьем лице', () => {
    assert.equal(forms('watch').third, 'watches');
    assert.equal(forms('wash').third, 'washes');
    assert.equal(forms('fix').third, 'fixes');
    assert.equal(forms('go').third, 'goes');
    assert.equal(forms('miss').third, 'misses');
  });

  test('удвоение согласной', () => {
    assert.ok(doublesFinal('stop') && doublesFinal('plan') && doublesFinal('quit'));
    assert.ok(!doublesFinal('rain') && !doublesFinal('fix') && !doublesFinal('play') && !doublesFinal('visit'));
    assert.equal(forms('stop').past, 'stopped');
    assert.equal(forms('shop').ing, 'shopping');
    assert.equal(forms('visit').past, 'visited');
    assert.equal(forms('open').ing, 'opening');
    assert.equal(forms('prefer', {}, true).past, 'preferred');
    assert.equal(forms('travel', {}, true).ing, 'travelling');
  });
});

describe('неправильные и фразовые глаголы', () => {
  test('participle по умолчанию совпадает с past', () => {
    assert.deepEqual(forms('buy', { past: 'bought' }), { past: 'bought', participle: 'bought', ing: 'buying', third: 'buys' });
    assert.equal(forms('go', { past: 'went', participle: 'gone' }).participle, 'gone');
  });

  test('фразовый глагол меняет только первое слово', () => {
    assert.deepEqual(forms('look for'), { past: 'looked for', participle: 'looked for', ing: 'looking for', third: 'looks for' });
    assert.equal(forms('get up', { past: 'got up' }).ing, 'getting up');
  });

  test('isIrregular, variants, allForms', () => {
    assert.ok(isIrregular({ past: 'went' }));
    assert.ok(!isIrregular({ ing: 'panicking' }));
    assert.ok(!isIrregular());
    assert.deepEqual(variants('learnt/learned'), ['learnt', 'learned']);
    assert.deepEqual(allForms({ past: 'was/were', participle: 'been' }), ['was', 'were', 'been']);
  });
});
