export const buildInvitationEmail = (params: {
  companyName: string;
  invitationUrl: string;
  expiresAt: Date;
}) => {
  const expirationText = params.expiresAt.toISOString();

  return {
    subject: `Invitación para administrar ${params.companyName}`,
    text: [
      `Has sido invitado para administrar la empresa ${params.companyName}.`,
      `Completa tu cuenta en: ${params.invitationUrl}`,
      `La invitación vence en: ${expirationText}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <h2>Invitación de acceso</h2>
        <p>Has sido invitado para administrar la empresa <strong>${params.companyName}</strong>.</p>
        <p>
          <a href="${params.invitationUrl}" style="display:inline-block;padding:10px 16px;background:#1b8f6a;color:white;text-decoration:none;border-radius:6px">
            Completar configuración de cuenta
          </a>
        </p>
        <p>Si no puedes hacer click, usa este enlace:</p>
        <p><a href="${params.invitationUrl}">${params.invitationUrl}</a></p>
        <p><small>La invitación vence en: ${expirationText}</small></p>
      </div>
    `
  };
};
