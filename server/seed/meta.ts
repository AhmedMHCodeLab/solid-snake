// Case metadata and minimised entities, the way an intelligence unit heads a case file. All values are synthetic.
import type { CaseMeta, Entity } from '../../shared/types';
import { NETS } from './ident';

export const HANDLING = 'SIMULATED // EXERCISE DATA';

const ent = (id: string, kind: Entity['kind'], role: string): Entity => ({ id, plainName: id === 'TFIU' ? 'The unit' : id.startsWith('EC-') ? `Business customer ${id.slice(3)}` : (NETS[id] as { plain: string }).plain, kind, role, basis: 'FICTION' });

const CARRIERS = (): Entity[] => [
  ent('IPX-3', 'Interconnect carrier', 'Delivers international calls to the operator on route 1'),
  ent('IPX-4', 'Interconnect carrier', 'Delivers international calls to the operator on route 2'),
  ent('IPX-5', 'Interconnect carrier', 'Delivers international calls to the operator on route 3'),
];
const UNIT = (): Entity => ent('TFIU', 'Unit', 'The telecom fraud intelligence unit that holds the case');

export const ENTITIES: Record<string, Entity[]> = {
  A: [ent('MNO-1', 'Mobile network operator', 'Referred the matter and holds the call records'), ...CARRIERS(), UNIT()],
  B: [ent('MNO-2', 'Mobile network operator', 'Referred the matter and holds the call records'), ...CARRIERS(), UNIT()],
  C: [ent('MNO-1', 'Mobile network operator', 'Referred the matter and holds the call records'), ...CARRIERS(), UNIT()],
  D: [
    ent('MNO-2', 'Mobile network operator', 'Referred the matter and holds the call records'),
    ent('EC-0147', 'Enterprise customer', 'Business customer whose phone line placed the calls'),
    ent('IPX-3', 'Interconnect carrier', 'Carries the calls out of the operator network'),
    UNIT(),
  ],
};

export const META: Record<string, CaseMeta> = {
  A: {
    reference: 'TFIU/2031/0112',
    opened: '2031-03-08',
    originator: 'Operator 1, revenue assurance team',
    tasking: 'Assess why eight SIMs on one cell area placed far more calls than ordinary SIMs, and say what evidence would settle the cause.',
    desk: 'Voice fraud desk',
    priority: 'Priority',
    handling: HANDLING,
  },
  B: {
    reference: 'TFIU/2031/0118',
    opened: '2031-03-15',
    originator: 'Operator 2, fraud management team',
    tasking: 'Assess whether a group of about fifty SIMs on one cell area is an abuse of the network or an ordinary business use.',
    desk: 'Voice fraud desk',
    priority: 'Routine',
    handling: HANDLING,
  },
  C: {
    reference: 'TFIU/2031/0124',
    opened: '2031-03-22',
    originator: 'Operator 1, revenue assurance team',
    tasking: 'Assess why 24 SIMs on one cell area place short calls of near-equal length to a handful of numbers.',
    desk: 'Voice fraud desk',
    priority: 'Routine',
    handling: HANDLING,
  },
  D: {
    reference: 'TFIU/2031/0131',
    opened: '2031-03-29',
    originator: 'Operator 2, interconnect and premium-rate team',
    tasking: 'Assess why one business line placed a burst of calls to a single premium-rate number block outside business hours.',
    desk: 'Premium-rate desk',
    priority: 'Priority',
    handling: HANDLING,
  },
};
