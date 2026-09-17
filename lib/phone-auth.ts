'use client';

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type UserCredential,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';

/**
 * Brazilian phone authentication utilities.
 *
 * Wraps Firebase Phone Auth with an invisible reCAPTCHA verifier and a strict
 * validation layer for Brazilian mobile numbers (`+55 XX XXXXX-XXXX`).
 *
 * Browser-only: every function that touches the DOM or Firebase Auth is guarded
 * with {@link ensureBrowser}, so importing this module during SSR is safe.
 */

/** Brazilian country calling code. */
export const BRAZIL_COUNTRY_CODE = '+55';

/** Length of a local Brazilian mobile number: 2-digit DDD + 9 digits. */
const LOCAL_MOBILE_LENGTH = 11;

/** Brazilian mobile numbers always start with 9 after the DDD. */
const MOBILE_PREFIX = '9';

/** Length of the SMS verification code issued by Firebase. */
const VERIFICATION_CODE_LENGTH = 6;

export type PhoneAuthErrorCode =
  | 'phone-auth/invalid-phone'
  | 'phone-auth/invalid-container'
  | 'phone-auth/recaptcha-unavailable'
  | 'phone-auth/recaptcha-not-initialized'
  | 'phone-auth/no-verification-in-progress'
  | 'phone-auth/invalid-code'
  | 'phone-auth/code-expired'
  | 'phone-auth/too-many-requests'
  | 'phone-auth/unknown';

/** Typed error thrown by every public helper in this module. */
export class PhoneAuthError extends Error {
  readonly code: PhoneAuthErrorCode;

  constructor(code: PhoneAuthErrorCode, message: string) {
    super(message);
    this.name = 'PhoneAuthError';
    this.code = code;
  }
}

export interface BrazilianPhoneValidation {
  /** Whether the input is a valid Brazilian mobile number. */
  valid: boolean;
  /** E.164 number (`+5511999999999`) when valid, otherwise null. */
  e164: string | null;
  /** Display number (`+55 11 99999-9999`) when valid, otherwise null. */
  formatted: string | null;
  /** Human-readable validation error when invalid, otherwise null. */
  error: string | null;
}

export interface RecaptchaInitOptions {
  /** Invoked when reCAPTCHA hands back a fresh token. */
  onSolved?: () => void;
  /** Invoked when a previously issued token expires. */
  onExpired?: () => void;
  /** Invoked when reCAPTCHA fails to load or verify. */
  onError?: (error: Error) => void;
}

export interface PhoneVerificationSession {
  /** Firebase verification id for the in-flight SMS challenge. */
  verificationId: string;
  /** Normalized E.164 phone number the code was sent to. */
  phoneNumber: string;
}

// --- module-level state -----------------------------------------------------

let recaptchaVerifier: RecaptchaVerifier | null = null;
let recaptchaContainerId: string | null = null;
let confirmationResult: ConfirmationResult | null = null;
let pendingPhoneNumber: string | null = null;

// --- phone formatting / validation -----------------------------------------

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function stripCountryCode(digits: string): string {
  // Only drop `55` when it is actually the country code (i.e. the number has
  // more digits than a local mobile) — a DDD of 55 must survive untouched.
  if (digits.startsWith('55') && digits.length > LOCAL_MOBILE_LENGTH) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Validates a Brazilian mobile number in any common input shape:
 * `+55 11 99999-9999`, `+5511999999999`, `(11) 99999-9999` or `11999999999`.
 */
export function validateBrazilianPhone(value: string): BrazilianPhoneValidation {
  const invalid = (error: string): BrazilianPhoneValidation => ({
    valid: false,
    e164: null,
    formatted: null,
    error,
  });

  const digits = stripCountryCode(onlyDigits(value));

  if (!digits) return invalid('Informe seu número de celular.');
  if (digits.length < LOCAL_MOBILE_LENGTH) {
    return invalid('Número incompleto. Informe DDD + 9 dígitos.');
  }
  if (digits.length > LOCAL_MOBILE_LENGTH) {
    return invalid('Número muito longo. Informe DDD + 9 dígitos.');
  }
  // Valid Brazilian DDDs never contain a zero digit.
  if (digits[0] === '0' || digits[1] === '0') {
    return invalid('DDD inválido.');
  }
  if (digits[2] !== MOBILE_PREFIX) {
    return invalid('Celular inválido: o número deve começar com 9 após o DDD.');
  }

  return {
    valid: true,
    e164: `${BRAZIL_COUNTRY_CODE}${digits}`,
    formatted: `${BRAZIL_COUNTRY_CODE} ${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`,
    error: null,
  };
}

/** Boolean convenience wrapper around {@link validateBrazilianPhone}. */
export function isValidBrazilianPhone(value: string): boolean {
  return validateBrazilianPhone(value).valid;
}

/**
 * Progressive mask for controlled inputs. Returns `(11) 99999-9999` style
 * output and tolerates partial values while the user is still typing.
 */
export function formatBrazilianPhoneInput(value: string): string {
  const digits = stripCountryCode(onlyDigits(value)).slice(0, LOCAL_MOBILE_LENGTH);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (!rest) return `(${ddd}) `;
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

// --- error helpers ----------------------------------------------------------

function readErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
}

function toPhoneAuthError(error: unknown): PhoneAuthError {
  if (error instanceof PhoneAuthError) return error;

  switch (readErrorCode(error)) {
    case 'auth/invalid-phone-number':
      return new PhoneAuthError(
        'phone-auth/invalid-phone',
        'Número de telefone inválido para envio do SMS.',
      );
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return new PhoneAuthError(
        'phone-auth/too-many-requests',
        'Muitas tentativas. Aguarde alguns instantes e tente novamente.',
      );
    case 'auth/code-expired':
      return new PhoneAuthError(
        'phone-auth/code-expired',
        'O código expirou. Solicite um novo SMS.',
      );
    case 'auth/invalid-verification-code':
    case 'auth/missing-verification-code':
      return new PhoneAuthError('phone-auth/invalid-code', 'Código de verificação inválido.');
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
    case 'auth/missing-app-credential':
    case 'auth/operation-not-allowed':
    case 'auth/unauthorized-domain':
      return new PhoneAuthError(
        'phone-auth/recaptcha-unavailable',
        'Não foi possível validar o reCAPTCHA. Recarregue a página e tente novamente.',
      );
    default:
      return new PhoneAuthError(
        'phone-auth/unknown',
        'Não foi possível concluir a verificação por telefone. Tente novamente.',
      );
  }
}

/** Maps any thrown value to the user-facing phone auth message. */
export function getPhoneAuthErrorMessage(error: unknown): string {
  return toPhoneAuthError(error).message;
}

function ensureBrowser(): void {
  if (typeof window === 'undefined') {
    throw new PhoneAuthError(
      'phone-auth/recaptcha-unavailable',
      'A autenticação por telefone só está disponível no navegador.',
    );
  }
}

// --- reCAPTCHA --------------------------------------------------------------

/**
 * Creates (or reuses) an invisible reCAPTCHA verifier anchored to a DOM
 * element — typically the "Receber código por SMS" button.
 *
 * @param buttonId - id of the element that hosts the invisible reCAPTCHA.
 */
export function initRecaptcha(
  buttonId: string,
  options: RecaptchaInitOptions = {},
): RecaptchaVerifier {
  ensureBrowser();

  if (!buttonId) {
    throw new PhoneAuthError('phone-auth/invalid-container', 'Informe o id do botão do reCAPTCHA.');
  }

  const container = document.getElementById(buttonId);
  if (!container) {
    throw new PhoneAuthError(
      'phone-auth/invalid-container',
      `Elemento #${buttonId} não encontrado para montar o reCAPTCHA.`,
    );
  }

  if (recaptchaVerifier && recaptchaContainerId === buttonId) {
    return recaptchaVerifier;
  }

  // Drop any verifier bound to a previous container before re-creating.
  clearRecaptcha();

  const verifier = new RecaptchaVerifier(auth, container, {
    size: 'invisible',
    callback: () => options.onSolved?.(),
    'expired-callback': () => options.onExpired?.(),
    'error-callback': () => options.onError?.(new Error('reCAPTCHA verification failed.')),
  });

  recaptchaVerifier = verifier;
  recaptchaContainerId = buttonId;
  return verifier;
}

/** Returns the active verifier, or null when {@link initRecaptcha} was not called. */
export function getRecaptchaVerifier(): RecaptchaVerifier | null {
  return recaptchaVerifier;
}

/** Destroys the current verifier and releases its DOM widget. Safe to call anytime. */
export function clearRecaptcha(): void {
  if (!recaptchaVerifier) return;
  try {
    recaptchaVerifier.clear();
  } catch {
    // Widget may never have rendered — nothing to release.
  }
  recaptchaVerifier = null;
  recaptchaContainerId = null;
}

// --- SMS flow ---------------------------------------------------------------

/**
 * Sends an SMS verification code to a Brazilian mobile number and stores the
 * pending confirmation so {@link verifyCode} can complete the sign-in.
 *
 * Requires {@link initRecaptcha} to have run first.
 */
export async function sendVerificationCode(phoneNumber: string): Promise<PhoneVerificationSession> {
  ensureBrowser();

  const validation = validateBrazilianPhone(phoneNumber);
  if (!validation.valid || !validation.e164) {
    throw new PhoneAuthError(
      'phone-auth/invalid-phone',
      validation.error ?? 'Informe um celular válido com DDD.',
    );
  }

  if (!recaptchaVerifier) {
    throw new PhoneAuthError(
      'phone-auth/recaptcha-not-initialized',
      'Verificação de segurança não inicializada. Recarregue a página e tente novamente.',
    );
  }

  try {
    const result = await signInWithPhoneNumber(auth, validation.e164, recaptchaVerifier);
    confirmationResult = result;
    pendingPhoneNumber = validation.e164;
    return { verificationId: result.verificationId, phoneNumber: validation.e164 };
  } catch (error) {
    throw toPhoneAuthError(error);
  }
}

/**
 * Confirms the SMS code for the in-flight challenge.
 *
 * @param code - the 6-digit code received via SMS.
 * @returns the authenticated Firebase {@link UserCredential}.
 */
export async function verifyCode(code: string): Promise<UserCredential> {
  ensureBrowser();

  const normalized = onlyDigits(code);
  if (normalized.length !== VERIFICATION_CODE_LENGTH) {
    throw new PhoneAuthError(
      'phone-auth/invalid-code',
      `Código inválido. Informe os ${VERIFICATION_CODE_LENGTH} dígitos enviados por SMS.`,
    );
  }

  if (!confirmationResult) {
    throw new PhoneAuthError(
      'phone-auth/no-verification-in-progress',
      'Nenhuma verificação em andamento. Solicite um novo código.',
    );
  }

  try {
    const credential = await confirmationResult.confirm(normalized);
    resetPhoneAuth();
    return credential;
  } catch (error) {
    // Keep the confirmation on failure so the user can retry the same code.
    throw toPhoneAuthError(error);
  }
}

/** Normalized phone number awaiting confirmation, or null when idle. */
export function getPendingPhoneNumber(): string | null {
  return pendingPhoneNumber;
}

/** Clears the pending SMS challenge and destroys the reCAPTCHA widget. */
export function resetPhoneAuth(): void {
  confirmationResult = null;
  pendingPhoneNumber = null;
  clearRecaptcha();
}
