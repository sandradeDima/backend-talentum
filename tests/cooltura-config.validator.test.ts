import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/errors/appError';
import { validateUpsertCoolturaConfig } from '../src/validators/cooltura-config.validator';

test('validateUpsertCoolturaConfig allows nullable and blank optional fields', () => {
  const result = validateUpsertCoolturaConfig({
    linkedinUrl: '',
    youtubeUrl: null,
    instagramUrl: '   ',
    facebookUrl: null,
    tiktokUrl: '',
    whatsappLink: null,
    boliviaDireccion: '',
    boliviaTelefono: null,
    boliviaEmail: '   ',
    paraguayDireccion: null,
    paraguayTelefono: '',
    paraguayEmail: null
  });

  assert.deepEqual(result, {
    linkedinUrl: null,
    youtubeUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    tiktokUrl: null,
    whatsappLink: null,
    boliviaDireccion: null,
    boliviaTelefono: null,
    boliviaEmail: null,
    paraguayDireccion: null,
    paraguayTelefono: null,
    paraguayEmail: null
  });
});

test('validateUpsertCoolturaConfig returns a clear validation message for invalid formats', () => {
  assert.throws(
    () =>
      validateUpsertCoolturaConfig({
        youtubeUrl: 'not-a-url',
        boliviaEmail: 'correo-invalido'
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(
        error.message,
        /YouTube debe tener una URL válida o quedar en blanco/i
      );
      assert.match(
        error.message,
        /Correo de Bolivia debe tener un correo válido o quedar en blanco/i
      );
      assert.match(error.mensajeTecnico ?? '', /youtubeUrl/);
      assert.match(error.mensajeTecnico ?? '', /boliviaEmail/);
      return true;
    }
  );
});
