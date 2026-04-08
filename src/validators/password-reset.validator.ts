import {
  confirmPasswordResetDtoSchema,
  validatePasswordResetTokenDtoSchema,
  type ConfirmPasswordResetDto,
  type ValidatePasswordResetTokenDto
} from '../dto/password-reset.dto';

export const validatePasswordResetToken = (
  input: unknown
): ValidatePasswordResetTokenDto => {
  return validatePasswordResetTokenDtoSchema.parse(input);
};

export const validateConfirmPasswordReset = (
  input: unknown
): ConfirmPasswordResetDto => {
  return confirmPasswordResetDtoSchema.parse(input);
};
