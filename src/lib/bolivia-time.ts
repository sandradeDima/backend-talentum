const BOLIVIA_UTC_OFFSET_MINUTES = -4 * 60;
const BOLIVIA_OFFSET_IN_MS = BOLIVIA_UTC_OFFSET_MINUTES * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type BoliviaDateParts = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
};

const toBoliviaParts = (value: Date): Required<BoliviaDateParts> => {
  const boliviaView = new Date(value.getTime() + BOLIVIA_OFFSET_IN_MS);

  return {
    year: boliviaView.getUTCFullYear(),
    month: boliviaView.getUTCMonth() + 1,
    day: boliviaView.getUTCDate(),
    hour: boliviaView.getUTCHours(),
    minute: boliviaView.getUTCMinutes()
  };
};

const matchesBoliviaParts = (value: Date, expected: BoliviaDateParts): boolean => {
  if (Number.isNaN(value.getTime())) {
    return false;
  }

  const observed = toBoliviaParts(value);

  return (
    observed.year === expected.year &&
    observed.month === expected.month &&
    observed.day === expected.day &&
    (typeof expected.hour === 'number' ? observed.hour === expected.hour : true) &&
    (typeof expected.minute === 'number' ? observed.minute === expected.minute : true)
  );
};

const createBoliviaDate = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) => {
  return new Date(Date.UTC(year, month - 1, day, hour - BOLIVIA_UTC_OFFSET_MINUTES / 60, minute));
};

export const parseBoliviaDateOnly = (
  input: string,
  mode: 'start' | 'end'
): Date | null => {
  const match = input.match(DATE_ONLY_PATTERN);

  if (!match) {
    return null;
  }

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = mode === 'start' ? 0 : 23;
  const minute = mode === 'start' ? 1 : 59;
  const value = createBoliviaDate(year, month, day, hour, minute);

  return matchesBoliviaParts(value, { year, month, day }) ? value : null;
};

export const parseBoliviaDateTimeInput = (input: string): Date => {
  const localMatch = input.match(DATE_TIME_PATTERN);

  if (!localMatch) {
    return new Date(input);
  }

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = localMatch;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const value = createBoliviaDate(year, month, day, hour, minute);

  return matchesBoliviaParts(value, { year, month, day, hour, minute })
    ? value
    : new Date(Number.NaN);
};
