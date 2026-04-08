export class AppError extends Error {
  public readonly statusCode: number;
  public readonly mensajeTecnico: string | null;

  constructor(
    message: string,
    statusCode = 400,
    mensajeTecnico: string | null = null
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.mensajeTecnico = mensajeTecnico;
  }
}
