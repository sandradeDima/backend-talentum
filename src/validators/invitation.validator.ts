import {
  acceptInvitationDtoSchema,
  validateInvitationTokenDtoSchema,
  type AcceptInvitationDto,
  type ValidateInvitationTokenDto
} from '../dto/invitation.dto';

export const validateAcceptInvitation = (input: unknown): AcceptInvitationDto => {
  return acceptInvitationDtoSchema.parse(input);
};

export const validateInvitationToken = (input: unknown): ValidateInvitationTokenDto => {
  return validateInvitationTokenDtoSchema.parse(input);
};
