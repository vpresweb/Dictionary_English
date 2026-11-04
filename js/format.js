// Общие подписи и экранирование для словаря и карточек.
import { isIrregular } from './verbs.js';

export const POS_LABELS = {
  noun: 'сущ.',
  verb: 'гл.',
  adj: 'прил.',
  adv: 'нареч.',
  prep: 'предл.',
  pron: 'мест.',
  conj: 'союз',
  interj: 'межд.',
  num: 'числ.',
  det: 'опред.',
  phrase: 'выражение',
};

export function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export function verbType(entry) {
  if (entry.pos !== 'verb') return null;
  return isIrregular(entry.forms) ? 'неправильный' : 'правильный';
}

export function entryMeta(entry) {
  const plural = entry.forms?.plural && `мн. ч. ${entry.forms.plural.replace(/\//g, ' / ')}`;
  return [POS_LABELS[entry.pos] ?? entry.pos, verbType(entry), plural]
    .filter(Boolean)
    .join(', ');
}
