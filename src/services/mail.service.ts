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

  private buildSurveyAccessCodeUrl(campaignSlug: string) {
    return `${env.FRONTEND_URL}/survey/${campaignSlug}/codigo`;
  }

  async sendSurveyInvitationEmail(input: {
    to: string;
    companyName: string;
    campaignName: string;
    campaignSlug: string;
    magicLinkToken: string;
    accessCode: string;
    expiresAt: Date;
  }) {
    const accessCodeUrl = this.buildSurveyAccessCodeUrl(input.campaignSlug);

    const template = buildSurveyInvitationEmail({
      companyName: input.companyName,
      campaignName: input.campaignName,
      accessCodeUrl,
      accessCode: input.accessCode
    });

    await mailer.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html
    });

    return { accessCodeUrl };
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
    const accessCodeUrl = this.buildSurveyAccessCodeUrl(input.campaignSlug);

    const template = buildSurveyReminderEmail({
      companyName: input.companyName,
      campaignName: input.campaignName,
      accessCodeUrl,
      accessCode: input.accessCode
    });

    await mailer.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html
    });

    return { accessCodeUrl };
  }
}
