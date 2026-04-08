import assert from 'node:assert/strict';
import test from 'node:test';
import { SurveyCampaignStatus } from '@prisma/client';
import { deriveSurveyLifecycle } from '../src/lib/survey-lifecycle';

const baseInput = {
  status: SurveyCampaignStatus.CREADA,
  startDate: new Date('2026-04-10T10:00:00.000Z'),
  endDate: new Date('2026-04-20T10:00:00.000Z'),
  initialSendScheduledAt: new Date('2026-04-09T10:00:00.000Z'),
  remindersLockedAt: null
};

test('deriveSurveyLifecycle resolves draft state when initial send is not scheduled', () => {
  const lifecycle = deriveSurveyLifecycle({
    ...baseInput,
    initialSendScheduledAt: null,
    now: new Date('2026-04-08T10:00:00.000Z')
  });

  assert.equal(lifecycle.state, 'DRAFT');
  assert.equal(lifecycle.canScheduleInitialSend, true);
  assert.equal(lifecycle.canCloseNow, false);
  assert.equal(lifecycle.canFinalize, false);
});

test('deriveSurveyLifecycle resolves scheduled state before start date', () => {
  const lifecycle = deriveSurveyLifecycle({
    ...baseInput,
    now: new Date('2026-04-09T12:00:00.000Z')
  });

  assert.equal(lifecycle.state, 'SCHEDULED');
  assert.equal(lifecycle.canConfigureReminders, true);
  assert.equal(lifecycle.canCloseNow, false);
});

test('deriveSurveyLifecycle resolves active state within the campaign window', () => {
  const lifecycle = deriveSurveyLifecycle({
    ...baseInput,
    now: new Date('2026-04-15T10:00:00.000Z')
  });

  assert.equal(lifecycle.state, 'ACTIVE');
  assert.equal(lifecycle.canCloseNow, true);
  assert.equal(lifecycle.canFinalize, false);
});

test('deriveSurveyLifecycle resolves closed state after end date when not finalized', () => {
  const lifecycle = deriveSurveyLifecycle({
    ...baseInput,
    now: new Date('2026-04-21T10:00:00.000Z')
  });

  assert.equal(lifecycle.state, 'CLOSED');
  assert.equal(lifecycle.canCloseNow, false);
  assert.equal(lifecycle.canFinalize, true);
});

test('deriveSurveyLifecycle resolves finalized state from persisted status', () => {
  const lifecycle = deriveSurveyLifecycle({
    ...baseInput,
    status: SurveyCampaignStatus.FINALIZADA,
    now: new Date('2026-04-21T10:00:00.000Z')
  });

  assert.equal(lifecycle.state, 'FINALIZED');
  assert.equal(lifecycle.finalized, true);
  assert.equal(lifecycle.canFinalize, false);
});
