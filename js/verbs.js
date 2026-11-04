// Формы английского глагола: Past Simple, Past Participle, -ing и 3-е лицо ед. ч. (he / she / it).
// Правильные формы строятся по правилам орфографии (британский вариант), неправильные задаются
// в поле forms статьи. Варианты одной формы пишутся через «/»: "learnt/learned".
// У фразовых глаголов (get up, look for) меняется только первое слово.

export const VERB_FORMS = [
  { key: 'past', label: 'Past Simple', ru: 'прошедшее время' },
  { key: 'participle', label: 'Past Participle', ru: 'причастие прошедшего времени' },
  { key: 'ing', label: '-ing', ru: 'причастие настоящего времени, герундий' },
  { key: 'third', label: 'he / she / it', ru: '3-е лицо ед. ч., настоящее время' },
];

export const ADJ_FORMS = [
  { key: 'comparative', label: 'Comparative', ru: 'сравнительная степень' },
  { key: 'superlative', label: 'Superlative', ru: 'превосходная степень' },
];

export const variants = (form) => form.split('/').map((s) => s.trim()).filter(Boolean);

// Удвоение конечной согласной (stop → stopped, plan → planning) делается автоматически
// для односложных слов на «одна гласная + согласная», кроме w, x, y. Многосложным
// с ударением на конце (prefer) и британским на -l (travel → travelled) нужен флаг double.
export function doublesFinal(word) {
  return /^[^aeiou]*(?:qu)?[aeiou][^aeiouwxy]$/.test(word);
}

function regular(word, double) {
  const dbl = double || doublesFinal(word);
  const last = word.at(-1);
  let past;
  if (word.endsWith('e')) past = `${word}d`;
  else if (/[^aeiou]y$/.test(word)) past = `${word.slice(0, -1)}ied`;
  else if (dbl) past = `${word}${last}ed`;
  else past = `${word}ed`;

  let ing;
  if (word.endsWith('ie')) ing = `${word.slice(0, -2)}ying`;
  else if (word.length > 2 && /([^aeiouy]|u)e$/.test(word)) ing = `${word.slice(0, -1)}ing`;
  else if (dbl) ing = `${word}${last}ing`;
  else ing = `${word}ing`;

  let third;
  if (/(s|x|z|ch|sh|o)$/.test(word)) third = `${word}es`;
  else if (/[^aeiou]y$/.test(word)) third = `${word.slice(0, -1)}ies`;
  else third = `${word}s`;

  return { past, participle: past, ing, third };
}

// forms — отличающиеся формы из статьи; participle по умолчанию совпадает с past.
export function verbForms(word, forms = {}, double = false) {
  const space = word.indexOf(' ');
  const head = space < 0 ? word : word.slice(0, space);
  const rest = space < 0 ? '' : word.slice(space);
  const auto = Object.fromEntries(Object.entries(regular(head, double)).map(([k, v]) => [k, v + rest]));
  const past = forms.past ?? auto.past;
  return {
    past,
    participle: forms.participle ?? (forms.past ? past : auto.participle),
    ing: forms.ing ?? auto.ing,
    third: forms.third ?? auto.third,
  };
}

export function isIrregular(forms = {}) {
  return Boolean(forms.past || forms.participle);
}

export function allForms(forms) {
  return Object.values(forms).flatMap(variants);
}
