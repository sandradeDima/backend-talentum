export const buildSurveyInvitationEmail = (params: {
  companyName: string;
  campaignName: string;
  accessCodeUrl: string;
  accessCode: string;
}) => {
  return {
    subject: `Encuesta disponible: ${params.campaignName}`,
    text: [
      'Hola,',
      '',
      'Te damos la bienvenida a la medición de Clima y Cultura organizacional.',
      '',
      'Buscamos conocer tu percepción y experiencia dentro de la organización, con el objetivo de identificar fortalezas y oportunidades de mejora que contribuyan a seguir construyendo un mejor entorno de trabajo para todos.',
      '',
      'Tu participación es muy importante en este proceso. Te invitamos a hacer clic en el enlace para empezar.',
      '',
      `Código de acceso: ${params.accessCode}`,
      `Ingresar aqui: ${params.accessCodeUrl}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <p>Hola,</p>
        <p>Te damos la bienvenida a la medición de Clima y Cultura organizacional.</p>
        <p>
          Buscamos conocer tu percepción y experiencia dentro de la organización, con el objetivo de identificar fortalezas y oportunidades de mejora que contribuyan a seguir construyendo un mejor entorno de trabajo para todos.
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
