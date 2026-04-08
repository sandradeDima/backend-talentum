export type SurveyTemplateContent = {
  introGeneral: string;
  leaderIntro: string;
  leaderQuestions: string[];
  teamIntro: string;
  teamQuestions: string[];
  organizationIntro: string;
  organizationQuestions: string[];
  finalNpsQuestion: string;
  finalOpenQuestion: string;
  closingText: string;
};

export const SURVEY_TEMPLATE_KEY = 'BASE_CLIMA_V1';

export const BASE_SURVEY_TEMPLATE: SurveyTemplateContent = {
  introGeneral:
    'Esta encuesta tiene como objetivo conocer tu percepción sobre el clima y la cultura de trabajo.\nTus respuestas son anónimas y confidenciales, y serán utilizadas únicamente con fines de análisis y mejora.\nNo existen respuestas correctas o incorrectas.\nRevisa cada afirmación y califica tu nivel de acuerdo del 1 al 5, donde:\n1 = Muy en desacuerdo\n5 = Muy de acuerdo',
  leaderIntro:
    'Las siguientes afirmaciones se refieren a la forma de trabajar y relacionarse de los líderes de la organización.\nPiensa en tu experiencia habitual y en cómo se dan las situaciones en el día a día de trabajo.',
  leaderQuestions: [
    'La comunicación es clara y oportuna.',
    'Se brinda retroalimentación sobre el trabajo y los resultados obtenidos.',
    'Los objetivos y responsabilidades están bien definidos.',
    'Los conflictos se manejan de manera adecuada.',
    'El trabajo es reconocido y valorado.',
    'Muestra predisposición frente a los cambios.'
  ],
  teamIntro:
    'A continuación, encontrarás afirmaciones relacionadas con el funcionamiento del equipo con el que trabajas. Piensa en la dinámica diaria, la colaboración y el ambiente en el equipo.',
  teamQuestions: [
    'Hay compañerismo y las relaciones de trabajo son positivas.',
    'Se colabora y se trabaja de manera conjunta.',
    'La forma de coordinar es clara y efectiva.',
    'Existe confianza en las capacidades del equipo.',
    'Se promueve el aprendizaje y el desarrollo profesional.',
    'Hay agilidad para adaptarse a los cambios.'
  ],
  organizationIntro:
    'Las siguientes afirmaciones se refieren a cómo funciona la organización en general. Desde tu percepción, evalúa los siguientes enunciados.',
  organizationQuestions: [
    'La información es comunicada de forma clara y oportuna.',
    'Las metas de la organización están claras para todos.',
    'El trabajo entre áreas está bien coordinado.',
    'La forma en que se toman las decisiones genera confianza.',
    'Existe orgullo por ser parte de la organización.',
    'Hay flexibilidad frente a los cambios.'
  ],
  finalNpsQuestion:
    'Del 1 al 10, donde 1 es la nota más baja y 10 la más alta, ¿qué tan probable es que recomiendes a un amigo o alguien cercano trabajar en esta organización?',
  finalOpenQuestion:
    'Queremos escucharte: ¿Qué podríamos hacer para mejorar tu experiencia como colaborador?',
  closingText:
    'Gracias por tomarte el tiempo para responder.\nTu opinión es clave para seguir construyendo un mejor lugar para trabajar.'
};
