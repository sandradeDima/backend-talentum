import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { InvitationRepository } from '../repositories/invitation.repository';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { SurveyRepository } from '../repositories/survey.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../services/auth.service';
import { BetterAuthService } from '../services/better-auth.service';
import { CompanyUserService } from '../services/company-user.service';
import { CompanyService } from '../services/company.service';
import { DashboardService } from '../services/dashboard.service';
import { InvitationService } from '../services/invitation.service';
import { MailService } from '../services/mail.service';
import { PasswordResetService } from '../services/password-reset.service';
import { ResourceLibraryService } from '../services/resource-library.service';
import { CoolturaConfigService } from '../services/cooltura-config.service';
import { SupportConfigService } from '../services/support-config.service';
import { SurveyExecutionService } from '../services/survey-execution.service';
import { SurveyOperationsService } from '../services/survey-operations.service';
import { SurveyService } from '../services/survey.service';
import { UploadService } from '../services/upload.service';

const userRepository = new UserRepository();
const companyRepository = new CompanyRepository();
const invitationRepository = new InvitationRepository();
const passwordResetTokenRepository = new PasswordResetTokenRepository();
const surveyRepository = new SurveyRepository();
const auditLogRepository = new AuditLogRepository();

const betterAuthService = new BetterAuthService();
const mailService = new MailService();
export const uploadService = new UploadService();

export const authService = new AuthService(
  betterAuthService,
  userRepository,
  companyRepository
);

export const companyService = new CompanyService(
  companyRepository,
  auditLogRepository
);

export const passwordResetService = new PasswordResetService(
  passwordResetTokenRepository,
  userRepository,
  auditLogRepository,
  mailService
);

export const companyUserService = new CompanyUserService(
  companyRepository,
  userRepository,
  invitationRepository,
  auditLogRepository,
  mailService,
  passwordResetService
);

export const invitationService = new InvitationService(
  invitationRepository,
  userRepository,
  companyRepository,
  auditLogRepository,
  betterAuthService
);

export const surveyService = new SurveyService(
  surveyRepository,
  companyRepository,
  auditLogRepository
);

export const surveyExecutionService = new SurveyExecutionService();
export const surveyOperationsService = new SurveyOperationsService(mailService);
export const dashboardService = new DashboardService();
export const resourceLibraryService = new ResourceLibraryService(
  companyRepository,
  auditLogRepository
);
export const supportConfigService = new SupportConfigService(
  companyRepository,
  auditLogRepository
);
export const coolturaConfigService = new CoolturaConfigService();
