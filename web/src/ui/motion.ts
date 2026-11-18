// Shared motion constants. Triggered moves last 0.4 s to 1.1 s on one easing set with no overshoot.
// Everything that is not in ANIMATED_CHANGES is instant: hover, focus, open, close, text updates, manual pan and zoom.
import type { Change } from '../../../shared/types';

/** Seconds. GSAP durations. The CSS custom properties --dur-* in tokens.css carry the same numbers. */
export const DURATION = { quick: 0.4, standard: 0.7, long: 1.1 } as const;

/**
 * GSAP ease names. None of them overshoots.
 * settle: things that arrive (a stroke drawn, a card lit).
 * travel: things that cross the room (the spotlight, the camera, a stage change).
 * draw: things that grow along a line (progress rail, hatch growth, area interpolation).
 * CSS equivalents are --ease-settle, --ease-travel and --ease-draw.
 */
export const EASE = { settle: 'power2.out', travel: 'power3.inOut', draw: 'power1.inOut' } as const;

/** The only changes that animate. Same names as Change['type'] in shared/types.ts. */
export const ANIMATED_CHANGES = ['level-rise', 'level-fall', 'stage', 'map', 'spotlight'] as const satisfies readonly Change['type'][];
export type AnimatedChange = (typeof ANIMATED_CHANGES)[number];

/** What each animation names, how long it runs and on which ease. The announce text of the Change is what it names. */
export const MOTION_BY_CHANGE: Record<AnimatedChange, { duration: number; ease: (typeof EASE)[keyof typeof EASE]; names: string }> = {
  'level-rise': { duration: DURATION.standard, ease: EASE.settle, names: 'The mark gains its next stroke and the entry moves to its new register.' },
  'level-fall': { duration: DURATION.standard, ease: EASE.settle, names: 'The frame breaks and is struck; the former level stays printed.' },
  stage: { duration: DURATION.long, ease: EASE.travel, names: 'The progress rail advances to the named stage.' },
  map: { duration: DURATION.long, ease: EASE.draw, names: 'An uncertainty area changes shape, or the camera changes plate.' },
  spotlight: { duration: DURATION.standard, ease: EASE.travel, names: 'The light crosses to the exhibit now under examination.' },
};

export function isAnimatedChange(type: string): type is AnimatedChange {
  return (ANIMATED_CHANGES as readonly string[]).includes(type);
}
