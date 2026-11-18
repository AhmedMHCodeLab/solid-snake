// Entry page: what the platform does, the five levels, and demo sign-in. No GSAP here.
import '../styles/index.css';
import './pages.css';
import { LEVEL_NAMES, type DemoUser, type Level } from '../../../shared/types';
import { api, setUser } from '../api/client';
import { levelMark } from '../ui/marks';
import { esc } from '../render/util';

const MEANS: Record<Level, string> = {
  1: 'A record exists with these values. Nothing more.',
  2: 'A measure of the records against a stated baseline. An ordering, never a probability.',
  3: 'Two independent sources point the same way. How independent they are is stated.',
  4: 'A named explanation, with its rivals and what would support or refute it.',
  5: 'Checked by evidence from outside the analysis. Only this level can be signed.',
};
document.getElementById('levels')!.innerHTML = ([1, 2, 3, 4, 5] as Level[])
  .map((l) => `<li class="levels__i"><span class="levels__mark on-paper">${levelMark(l, { size: 40 })}</span><span class="levels__n">${l}</span><span class="levels__name${l === 4 ? ' t-hyp' : ''}">${esc(LEVEL_NAMES[l])}</span><span class="levels__d">${esc(MEANS[l])}</span></li>`)
  .join('');

const FALLBACK: DemoUser[] = [
  { id: 'analyst-1', displayName: 'Analyst 1', role: 'analyst', basis: 'FICTION' },
  { id: 'analyst-2', displayName: 'Analyst 2', role: 'analyst', basis: 'FICTION' },
  { id: 'supervisor-1', displayName: 'Supervisor 1', role: 'supervisor', basis: 'FICTION' },
];
const ROLE: Record<string, string> = { analyst: 'Opens cases, requests evidence, signs at level 5', supervisor: 'Checks and countersigns another user’s signature', 'unit-lead': 'Receives referrals' };
async function users() {
  let list = FALLBACK;
  try { list = (await api.session()).users; } catch {
    const e = document.getElementById('err')!;
    e.hidden = false;
    e.textContent = 'The platform service did not answer. You can still choose an account; the console will retry.';
  }
  document.getElementById('users')!.innerHTML = list
    .map((u) => `<li><button class="user" type="button" data-user="${esc(u.id)}"><span class="user__n">${esc(u.displayName)}</span><span class="user__r">${esc(u.role)}</span><span class="user__d">${esc(ROLE[u.role] ?? '')}</span><span class="user__go" aria-hidden="true">Sign in</span></button></li>`)
    .join('');
}
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-user]');
  if (!b) return;
  setUser(b.dataset.user!);
  location.href = '/console/';
});
void users();
