import assert from 'node:assert/strict';
import test from 'node:test';
import { Role, RespondentCredentialType } from '@prisma/client';
import { AppError } from '../src/errors/appError';
import { SurveyOperationsService } from '../src/services/survey-operations.service';
import type { SessionPrincipal } from '../src/types/auth';

const adminPrincipal: SessionPrincipal = {
  id: 'admin_1',
  email: 'admin@talentum.test',
  name: 'Admin',
  role: Role.ADMIN,
  companyId: null,
  companySlug: null,
  isActive: true
};

const clientAdminPrincipal: SessionPrincipal = {
  id: 'client_admin_1',
  email: 'client-admin@talentum.test',
  name: 'Client Admin',
  role: Role.CLIENT_ADMIN,
  companyId: 'company_1',
  companySlug: 'company-1',
  isActive: true
};

const service = new SurveyOperationsService({} as never);

test('SurveyOperationsService.importRespondents rejects CLIENT_ADMIN for sensitive operations', async () => {
  await assert.rejects(
    service.importRespondents(
      'company-1',
      'survey-1',
      {
        fileName: 'participants.csv',
        mimeType: 'text/csv',
        base64: Buffer.from('identifier\n123456', 'utf8').toString('base64'),
        dryRun: true,
        generateCredentials: false,
        credentialType: RespondentCredentialType.TOKEN,
        regenerateCredentials: false,
        sendInvitations: false,
        includeRawCredentials: false
      },
      clientAdminPrincipal
    ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      assert.equal(error.mensajeTecnico, 'SURVEY_OPERATIONS_ADMIN_REQUIRED');
      return true;
    }
  );
});

test('SurveyOperationsService.generateCredentials rejects CLIENT_ADMIN', async () => {
  await assert.rejects(
    service.generateCredentials(
      'company-1',
      'survey-1',
      {
        credentialType: RespondentCredentialType.TOKEN,
        regenerateCredentials: true,
        sendInvitations: false,
        includeRawCredentials: false
      },
      clientAdminPrincipal
    ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      assert.equal(error.mensajeTecnico, 'SURVEY_OPERATIONS_ADMIN_REQUIRED');
      return true;
    }
  );
});

test('SurveyOperationsService.createReminderSchedules rejects CLIENT_ADMIN', async () => {
  await assert.rejects(
    service.createReminderSchedules(
      'company-1',
      'survey-1',
      {
        schedules: [
          {
            scheduledAt: '2099-01-01T10:00'
          }
        ]
      },
      clientAdminPrincipal
    ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      assert.equal(error.mensajeTecnico, 'SURVEY_OPERATIONS_ADMIN_REQUIRED');
      return true;
    }
  );
});

test('SurveyOperationsService sensitive operations remain callable by ADMIN without role rejection', async () => {
  await assert.rejects(
    service.generateCredentials(
      'company-1',
      'survey-1',
      {
        credentialType: RespondentCredentialType.TOKEN,
        regenerateCredentials: true,
        sendInvitations: false,
        includeRawCredentials: false
      },
      adminPrincipal
    ),
    (error: unknown) => {
      if (error instanceof AppError) {
        assert.notEqual(error.mensajeTecnico, 'SURVEY_OPERATIONS_ADMIN_REQUIRED');
      }
      return true;
    }
  );
});
