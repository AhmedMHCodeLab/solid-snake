// About page: the five levels and the six basis labels, drawn with the same marks as the console. No GSAP here.
import '../styles/index.css';
import '../home/pages.css';
import { LEVEL_NAMES, type Basis, type Level } from '../../../shared/types';
import { levelMark } from '../ui/marks';
import { basisLabel, esc } from '../render/util';

const SAY: Record<Level, [string, string]> = {
  1: ['A record exists with these values.', 'That the record is complete, correctly timed, or describes the world.'],
  2: ['A reproducible measure of the records against a stated baseline. An ordering, not a probability.', 'That the cause is fraud.'],
  3: ['Two or more independent sources point the same way, with their independence stated.', 'That the explanation is unique.'],
  4: ['A named explanation, its rivals, and what would support or refute it.', 'That the explanation is true.'],
  5: ['Checked by evidence from outside the analysis. Only this level can be signed.', 'Anything about real people or places.'],
};
document.getElementById('levels')!.innerHTML = ([1, 2, 3, 4, 5] as Level[])
  .map((l) => `<li class="levels__i"><span class="levels__mark on-paper">${levelMark(l, { size: 40 })}</span><span class="levels__n">${l}</span><span class="levels__name${l === 4 ? ' t-hyp' : ''}">${esc(LEVEL_NAMES[l])}</span><span class="levels__d">${esc(SAY[l][0])} <em>Cannot say:</em> ${esc(SAY[l][1])}</span></li>`)
  .join('');

const BASIS: [Basis, string][] = [
  ['FACT', 'Stated in a primary or official source that was opened and read.'],
  ['RESEARCH', 'Reported by a peer-reviewed or preprint paper.'],
  ['PRACTICE', 'Described in industry or vendor material; a claim by that source, not independent proof.'],
  ['ASSUMPTION', 'A working premise of the model that no source confirms.'],
  ['FICTION', 'A synthetic element of the demo data. Never presented as real.'],
  ['PROPOSAL', 'A product decision that the people who own the product can reverse.'],
];
document.getElementById('bases')!.innerHTML = BASIS.map(([b, t]) => `<div><dt>${basisLabel(b)}</dt><dd>${esc(t)}</dd></div>`).join('');
