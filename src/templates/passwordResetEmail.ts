export const buildPasswordResetEmail = (params: {
  userName: string;
  companyName: string;
  resetUrl: string;
  expiresAt: Date;
}) => {
  const expirationText = params.expiresAt.toISOString();

  return {
    subject: `Restablece tu contraseña de ${params.companyName}`,
    text: [
      `Hola ${params.userName},`,
      'Recibiste una solicitud para resetear tu contraseña en Talentum.',
      `Define una nueva contraseña en: ${params.resetUrl}`,
      `El enlace vence en: ${expirationText}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <h2>Restablecer contraseña</h2>
        <p>Hola <strong>${params.userName}</strong>,</p>
        <p>Recibiste una solicitud para resetear tu contraseña de acceso a <strong>${params.companyName}</strong>.</p>
        <p>
          <a href="${params.resetUrl}" style="display:inline-block;padding:10px 16px;background:#1b8f6a;color:white;text-decoration:none;border-radius:6px">
            Definir nueva contraseña
          </a>
        </p>
        <p>Si no puedes hacer click, usa este enlace:</p>
        <p><a href="${params.resetUrl}">${params.resetUrl}</a></p>
        <p><small>El enlace vence en: ${expirationText}</small></p>
      </div>
    `
  };
};
