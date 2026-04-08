import {
  type UploadCompanyLogoDto,
  uploadCompanyLogoDtoSchema
} from '../dto/upload.dto';

export const validateUploadCompanyLogo = (input: unknown): UploadCompanyLogoDto => {
  return uploadCompanyLogoDtoSchema.parse(input);
};
