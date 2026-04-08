export const buildSurveyReminderEmail = (params: {
  companyName: string;
  campaignName: string;
  magicLinkUrl: string;
  accessCodeUrl: string;
  accessCode: string;
  expiresAt: Date;
}) => {
  const expirationText = params.expiresAt.toISOString();

  return {
    subject: `Recordatorio encuesta: ${params.campaignName}`,
    text: [
      `Este es un recordatorio para completar la encuesta "${params.campaignName}" de ${params.companyName}.`,
      `Magic link: ${params.magicLinkUrl}`,
      `Ingreso con código: ${params.accessCodeUrl}`,
      `Código de acceso (documento): ${params.accessCode}`,
      `La credencial del magic link vence en: ${expirationText}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <h2>Recordatorio de encuesta</h2>
        <p>Tienes una encuesta pendiente: <strong>${params.campaignName}</strong>.</p>
        <p>
          <a href="${params.magicLinkUrl}" style="display:inline-block;padding:10px 16px;background:#1b8f6a;color:white;text-decoration:none;border-radius:6px">
            Entrar con magic link
          </a>
        </p>
        <p><strong>Código de acceso (documento)</strong>: ${params.accessCode}</p>
        <p>
          Si prefieres ingresar manualmente con tu código, usa este enlace:
          <a href="${params.accessCodeUrl}">${params.accessCodeUrl}</a>
        </p>
        <p><small>La credencial del magic link vence en: ${expirationText}</small></p>
      </div>
    `
  };
};
