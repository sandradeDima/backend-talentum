export type ApiSuccess<T = unknown> = {
  error: false;
  mensaje: string;
  data: T;
  mensajeTecnico: null;
};

export type ApiError = {
  error: true;
  mensaje: string;
  data: null;
  mensajeTecnico: string;
};

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
