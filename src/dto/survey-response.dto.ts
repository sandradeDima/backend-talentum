import { z } from 'zod';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema)
  ])
);

const answerInputSchema = z.object({
  questionKey: z.string().trim().min(1).max(120),
  sectionKey: z.string().trim().min(1).max(80).nullable().optional(),
  value: jsonValueSchema
});

const assertUniqueQuestionKeys = (
  answers: Array<{ questionKey: string }>,
  ctx: z.RefinementCtx
) => {
  const seen = new Set<string>();

  answers.forEach((answer, index) => {
    if (seen.has(answer.questionKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answers', index, 'questionKey'],
        message: 'No se permiten claves de pregunta duplicadas en la misma solicitud'
      });
      return;
    }

    seen.add(answer.questionKey);
  });
};

export const startSurveyResponseDtoSchema = z.object({
  sessionToken: z.string().trim().min(16).max(512)
});

export const autosaveSurveyResponseDtoSchema = z
  .object({
    sessionToken: z.string().trim().min(16).max(512),
    answers: z.array(answerInputSchema).min(1).max(500)
  })
  .superRefine((input, ctx) => {
    assertUniqueQuestionKeys(input.answers, ctx);
  });

export const submitSurveyResponseDtoSchema = z
  .object({
    sessionToken: z.string().trim().min(16).max(512),
    answers: z.array(answerInputSchema).min(1).max(500).optional()
  })
  .superRefine((input, ctx) => {
    if (input.answers) {
      assertUniqueQuestionKeys(input.answers, ctx);
    }
  });

export type SurveyAnswerInputDto = z.infer<typeof answerInputSchema>;
export type StartSurveyResponseDto = z.infer<typeof startSurveyResponseDtoSchema>;
export type AutosaveSurveyResponseDto = z.infer<typeof autosaveSurveyResponseDtoSchema>;
export type SubmitSurveyResponseDto = z.infer<typeof submitSurveyResponseDtoSchema>;
