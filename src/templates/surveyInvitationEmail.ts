export const buildSurveyInvitationEmail = (params: {
  companyName: string;
  campaignName: string;
  magicLinkUrl: string;
  accessCodeUrl?: string;
  accessCode?: string;
  expiresAt: Date;
}) => {
  const expirationText = params.expiresAt.toISOString();
  const manualAccessLines =
    params.accessCode && params.accessCodeUrl
      ? [
          `Ingreso con código: ${params.accessCodeUrl}`,
          `Código de acceso (documento): ${params.accessCode}`
        ]
      : [];
  const manualAccessHtml =
    params.accessCode && params.accessCodeUrl
      ? `
        <p><strong>Código de acceso (documento)</strong>: ${params.accessCode}</p>
        <p>
          Si prefieres ingresar manualmente con tu código, usa este enlace:
          <a href="${params.accessCodeUrl}">${params.accessCodeUrl}</a>
        </p>
      `
      : '';

  return {
    subject: `Encuesta disponible: ${params.campaignName}`,
    text: [
      `Tu organización ${params.companyName} habilitó la encuesta "${params.campaignName}".`,
      `Magic link: ${params.magicLinkUrl}`,
      ...manualAccessLines,
      `La credencial del magic link vence en: ${expirationText}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <h2>Encuesta de experiencia</h2>
        <p>Tu organización <strong>${params.companyName}</strong> habilitó la encuesta <strong>${params.campaignName}</strong>.</p>
        <p>
          <a href="${params.magicLinkUrl}" style="display:inline-block;padding:10px 16px;background:#1b8f6a;color:white;text-decoration:none;border-radius:6px">
            Entrar con magic link
          </a>
        </p>
        ${manualAccessHtml}
        <p>Si no puedes hacer click en el magic link, usa este enlace:</p>
        <p><a href="${params.magicLinkUrl}">${params.magicLinkUrl}</a></p>
        <p><small>La credencial del magic link vence en: ${expirationText}</small></p>
      </div>
    `
  };
};
