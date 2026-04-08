import { SurveyCampaignStatus } from '@prisma/client';

export type SurveyLifecycleState =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'CLOSED'
  | 'FINALIZED';

export type SurveyLifecycle = {
  state: SurveyLifecycleState;
  started: boolean;
  ended: boolean;
  finalized: boolean;
  remindersLocked: boolean;
  canScheduleInitialSend: boolean;
  canConfigureReminders: boolean;
  canCloseNow: boolean;
  canFinalize: boolean;
};

export type SurveyLifecycleInput = {
  status: SurveyCampaignStatus;
  startDate: Date;
  endDate: Date;
  initialSendScheduledAt: Date | null;
  remindersLockedAt: Date | null;
  now?: Date;
};

export const deriveSurveyLifecycle = (
  input: SurveyLifecycleInput
): SurveyLifecycle => {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const started = nowMs >= input.startDate.getTime();
  const ended = nowMs >= input.endDate.getTime();
  const remindersLocked = Boolean(input.remindersLockedAt);

  let state: SurveyLifecycleState;

  if (input.status === SurveyCampaignStatus.FINALIZADA) {
    state = 'FINALIZED';
  } else if (!input.initialSendScheduledAt) {
    state = 'DRAFT';
  } else if (!started) {
    state = 'SCHEDULED';
  } else if (!ended) {
    state = 'ACTIVE';
  } else {
    state = 'CLOSED';
  }

  return {
    state,
    started,
    ended,
    finalized: state === 'FINALIZED',
    remindersLocked,
    canScheduleInitialSend: state === 'DRAFT',
    canConfigureReminders:
      (state === 'SCHEDULED' || state === 'ACTIVE') && !remindersLocked,
    canCloseNow: state === 'ACTIVE',
    canFinalize: state === 'CLOSED'
  };
};
