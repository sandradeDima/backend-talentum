import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseBoliviaDateOnly,
  parseBoliviaDateTimeInput
} from '../src/lib/bolivia-time';

test('parseBoliviaDateTimeInput converts Bolivia wall-clock input to UTC', () => {
  const value = parseBoliviaDateTimeInput('2026-06-10T08:30');

  assert.equal(value.toISOString(), '2026-06-10T12:30:00.000Z');
});

test('parseBoliviaDateOnly stores survey start at the start of the Bolivia day', () => {
  const value = parseBoliviaDateOnly('2026-06-10', 'start');

  assert.ok(value);
  assert.equal(value?.toISOString(), '2026-06-10T04:01:00.000Z');
});

test('parseBoliviaDateOnly stores survey end at the end of the Bolivia day', () => {
  const value = parseBoliviaDateOnly('2026-06-10', 'end');

  assert.ok(value);
  assert.equal(value?.toISOString(), '2026-06-11T03:59:00.000Z');
});

test('parseBoliviaDateTimeInput rejects impossible calendar values', () => {
  const value = parseBoliviaDateTimeInput('2026-02-30T09:15');

  assert.equal(Number.isNaN(value.getTime()), true);
});
