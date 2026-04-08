import assert from 'node:assert/strict';
import test from 'node:test';
import { DashboardGroupBy, Role } from '@prisma/client';
import { AppError } from '../src/errors/appError';
import { DashboardService } from '../src/services/dashboard.service';
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

const service = new DashboardService();

test('DashboardService.createDashboardExportJob rejects CLIENT_ADMIN', async () => {
  await assert.rejects(
    service.createDashboardExportJob(
      {
        surveySlug: 'survey-1',
        groupBy: DashboardGroupBy.COMPANY
      },
      clientAdminPrincipal
    ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      assert.equal(error.mensajeTecnico, 'DASHBOARD_EXPORT_ADMIN_REQUIRED');
      return true;
    }
  );
});

test('DashboardService.getDashboardExportDownload rejects CLIENT_ADMIN', async () => {
  await assert.rejects(
    service.getDashboardExportDownload('job_123', clientAdminPrincipal),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      assert.equal(error.mensajeTecnico, 'DASHBOARD_EXPORT_ADMIN_REQUIRED');
      return true;
    }
  );
});

test('DashboardService export methods remain callable by ADMIN without role rejection', async () => {
  await assert.rejects(
    service.getDashboardExportDownload('job_123', adminPrincipal),
    (error: unknown) => {
      if (error instanceof AppError) {
        assert.notEqual(error.mensajeTecnico, 'DASHBOARD_EXPORT_ADMIN_REQUIRED');
      }
      return true;
    }
  );
});
