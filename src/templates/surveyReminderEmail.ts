export const buildSurveyReminderEmail = (params: {
  companyName: string;
  campaignName: string;
  accessCodeUrl: string;
  accessCode: string;
}) => {
  return {
    subject: `Recordatorio encuesta: ${params.campaignName}`,
    text: [
      'Hola,',
      '',
      `Tienes pendiente completar la medición de Clima y Cultura organizacional de ${params.companyName}.`,
      '',
      'Tu participación es muy importante en este proceso. Te invitamos a hacer clic en el enlace para empezar.',
      '',
      `Código de acceso: ${params.accessCode}`,
      `Ingresar aqui: ${params.accessCodeUrl}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <p>Hola,</p>
        <p>
          Tienes pendiente completar la medición de Clima y Cultura organizacional de <strong>${params.companyName}</strong>.
        </p>
        <p>
          Tu participación es muy importante en este proceso. Te invitamos a hacer clic en el enlace para empezar.
        </p>
        <p><strong>Código de acceso</strong>: ${params.accessCode}</p>
        <p>
          <a href="${params.accessCodeUrl}" style="display:inline-block;padding:10px 16px;background:#1b8f6a;color:white;text-decoration:none;border-radius:6px">
            Ingresar aqui
          </a>
        </p>
        <p>
          Si el botón no se abre correctamente, puedes ingresar desde este enlace:
          <a href="${params.accessCodeUrl}">${params.accessCodeUrl}</a>
        </p>
      </div>
    `
  };
};
