/**
 * useWheels — the botsjef's saved wheels and the spins handed out from them.
 *
 * **PROTOTYPE: nothing here touches the database.** Wheels, assigned spins and
 * results live in memory for the session, seeded with two demo wheels, so the
 * flow can be tried and judged before a schema exists. Closing the app resets
 * it. The spin is also decided on the phone, which is fine for a prototype and
 * not for real use — when this is wired up, the result must come from the
 * server, or a player can pick their own outcome.
 *
 * The rule the wheel follows: the botsjef writes 2–10 items, and **every item
 * goes on the wheel twice**, its two copies directly opposite each other
 * (`wheelSegments`). Each segment is the same size, so every item has the same
 * chance, and a 2-item wheel still looks like a wheel.
 */
import { useEffect, useState } from 'react';

export type WheelKind = 'forfeit' | 'reward';

export interface Wheel {
  id: string;
  name: string;
  kind: WheelKind;
  items: string[];
}

export interface PendingSpin {
  id: string;
  wheelId: string;
  athleteId: string;
  athleteName: string;
  assignedAt: string;
}

export interface SpinResult {
  id: string;
  wheelName: string;
  athleteName: string;
  item: string;
  at: string;
}

export const MIN_ITEMS = 2;
export const MAX_ITEMS = 10;

let wheels: Wheel[] = [
  {
    id: 'demo-forfeit',
    name: 'Straffehjulet',
    kind: 'forfeit',
    items: ['Synge på bussen', 'Bære ballnettet en uke', 'Kjøpe kaffe til alle', 'Rydde garderoben', 'Tale på lagmiddagen'],
  },
  {
    id: 'demo-reward',
    name: 'Belønningshjulet',
    kind: 'reward',
    items: ['Bota er slettet', 'Velg musikken i garderoben', 'Fri fra bæring', 'Botsjefen kjøper kaffe'],
  },
];
let pending: PendingSpin[] = [];
let results: SpinResult[] = [];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Each item twice, the copies opposite: [a, b, c] → [a, b, c, a, b, c]. */
export function wheelSegments(items: string[]): { label: string; itemIndex: number }[] {
  const once = items.map((label, itemIndex) => ({ label, itemIndex }));
  return [...once, ...once];
}

export function saveWheel(w: Omit<Wheel, 'id'> & { id?: string }): Wheel {
  const wheel: Wheel = { ...w, id: w.id ?? newId() };
  wheels = w.id ? wheels.map(x => (x.id === w.id ? wheel : x)) : [...wheels, wheel];
  emit();
  return wheel;
}

export function deleteWheel(id: string) {
  wheels = wheels.filter(w => w.id !== id);
  pending = pending.filter(p => p.wheelId !== id);
  emit();
}

export function assignSpin(wheelId: string, players: { id: string; name: string }[]) {
  const at = new Date().toISOString();
  pending = [
    ...pending,
    ...players.map(p => ({ id: newId(), wheelId, athleteId: p.id, athleteName: p.name, assignedAt: at })),
  ];
  emit();
}

/** A spin is used up the moment it lands. */
export function completeSpin(spinId: string | null, wheel: Wheel, athleteName: string, item: string) {
  if (spinId) pending = pending.filter(p => p.id !== spinId);
  results = [{ id: newId(), wheelName: wheel.name, athleteName, item, at: new Date().toISOString() }, ...results];
  emit();
}

export function useWheels() {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick(n => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return { wheels, pending, results };
}

export function getWheel(id: string): Wheel | undefined {
  return wheels.find(w => w.id === id);
}
