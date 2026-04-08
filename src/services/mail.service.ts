import { env } from '../config/env';
import { mailer } from '../lib/mailer';
import { buildInvitationEmail } from '../templates/invitationEmail';
import { buildPasswordResetEmail } from '../templates/passwordResetEmail';
import { buildSurveyInvitationEmail } from '../templates/surveyInvitationEmail';
import { buildSurveyReminderEmail } from '../templates/surveyReminderEmail';

export class MailService {
  async sendInvitationEmail(input: {
    to: string;
    companyName: string;
    rawToken: string;
    expiresAt: Date;
  }) {
    const invitationUrl = `${env.FRONTEND_URL}/invite/accept?token=${encodeURIComponent(input.rawToken)}`;

    const template = buildInvitationEmail({
      companyName: input.companyName,
      invitationUrl,
      expiresAt: input.expiresAt
    });

    await mailer.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html
    });

    return { invitationUrl };
  }

  async sendPasswordResetEmail(input: {
    to: string;
    userName: string;
    companyName: string;
    rawToken: string;
    expiresAt: Date;
  }) {
    const resetUrl = `${env.FRONTEND_URL}/password/reset?token=${encodeURIComponent(input.rawToken)}`;

    const template = buildPasswordResetEmail({
      userName: input.userName,
      companyName: input.companyName,
      resetUrl,
      expiresAt: input.expiresAt
    });

    await mailer.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html
    });

    return { resetUrl };
  }

  private buildSurveyMagicLinkUrl(campaignSlug: string, rawCredential: string) {
    const basePath = `${env.FRONTEND_URL}/survey/${campaignSlug}`;
    return `${basePath}?token=${encodeURIComponent(rawCredential)}`;
  }

  private buildSurveyAccessCodeUrl(campaignSlug: string) {
    return `${env.FRONTEND_URL}/survey/${campaignSlug}/codigo`;
  }

  async sendSurveyInvitationEmail(input: {
    to: string;
    companyName: string;
    campaignName: string;
    campaignSlug: string;
    magicLinkToken: string;
    accessCode?: string;
    expiresAt: Date;
  }) {
    const magicLinkUrl = this.buildSurveyMagicLinkUrl(
      input.campaignSlug,
      input.magicLinkToken
    );

    const template = buildSurveyInvitationEmail({
      companyName: input.companyName,
      campaignName: input.campaignName,
      magicLinkUrl,
      ...(input.accessCode
        ? {
            accessCodeUrl: this.buildSurveyAccessCodeUrl(input.campaignSlug),
            accessCode: input.accessCode
          }
        : {}),
      expiresAt: input.expiresAt
    });

    await mailer.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html
    });

    return {
      magicLinkUrl,
      ...(input.accessCode
        ? { accessCodeUrl: this.buildSurveyAccessCodeUrl(input.campaignSlug) }
        : {})
    };
  }

  async sendSurveyReminderEmail(input: {
    to: string;
    companyName: string;
    campaignName: string;
    campaignSlug: string;
    magicLinkToken: string;
    accessCode: string;
    expiresAt: Date;
  }) {
    const magicLinkUrl = this.buildSurveyMagicLinkUrl(
      input.campaignSlug,
      input.magicLinkToken
    );
    const accessCodeUrl = this.buildSurveyAccessCodeUrl(input.campaignSlug);

    const template = buildSurveyReminderEmail({
      companyName: input.companyName,
      campaignName: input.campaignName,
      magicLinkUrl,
      accessCodeUrl,
      accessCode: input.accessCode,
      expiresAt: input.expiresAt
    });

    await mailer.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html
    });

    return { magicLinkUrl, accessCodeUrl };
  }
}
