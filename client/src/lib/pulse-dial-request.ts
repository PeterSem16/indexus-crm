export type PulseDialHandler = (phoneNumber: string) => void | Promise<void>;

export function requestPulseDial(
  handler: PulseDialHandler | undefined,
  phoneNumber: string | null | undefined,
): Promise<boolean> {
  const normalizedPhone = phoneNumber?.trim();
  if (!handler || !normalizedPhone) return Promise.resolve(false);

  return Promise.resolve(handler(normalizedPhone)).then(() => true);
}

export function createPulseDialEntryPoints(
  centralDial: PulseDialHandler,
  _isSipRegistered: boolean,
) {
  return {
    main: centralDial,
    quick: centralDial,
    clinic: centralDial,
    mobile: centralDial,
  } as const;
}