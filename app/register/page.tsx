'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import {
  ArrowLeft,
  Check,
  Goal,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/firebase';
import {
  getPhoneAuthErrorMessage,
  initRecaptcha,
  resetPhoneAuth,
  sendVerificationCode,
  validateBrazilianPhone,
  verifyCode,
} from '@/lib/phone-auth';

/** Landing spot for authenticated users. */
const APP_HOME = '/app';
const LOGIN_PATH = '/login';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const PHONE_LOCAL_LENGTH = 11;

type Method = 'email' | 'phone';
type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  phone?: string;
};

const perks: string[] = [
  'Uma conta para participar de vários futebóis',
  'Convide a galera e monte o elenco com cartinhas',
  'Placar ao vivo, rankings e caixa sempre em dia',
];

function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.';
    case 'auth/invalid-email':
      return 'E-mail inválido. Confira o endereço digitado.';
    case 'auth/weak-password':
      return `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    case 'auth/missing-password':
      return 'Informe uma senha.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente em alguns instantes.';
    case 'auth/network-request-failed':
      return 'Falha de conexão. Verifique sua internet e tente de novo.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Cadastro com Google cancelado.';
    case 'auth/popup-blocked':
      return 'O pop-up do Google foi bloqueado. Permita pop-ups e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta com este e-mail usando outro método de acesso.';
    case 'auth/operation-not-allowed':
      return 'Este método de acesso ainda não está habilitado.';
    default:
      return 'Não foi possível criar sua conta. Tente novamente.';
  }
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, PHONE_LOCAL_LENGTH);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (!rest) return `(${ddd}) `;
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const { user, loading } = useAuth();

  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'phone' | 'code'>('phone');
  const [smsSending, setSmsSending] = useState(false);
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const recaptchaReady = useRef(false);

  useEffect(() => {
    if (!loading && user) {
      window.location.replace(APP_HOME);
    }
  }, [loading, user]);

  useEffect(() => () => resetPhoneAuth(), []);

  function handleMethodChange(value: Method) {
    setMethod(value);
    setErrors({});
    setFormError(null);
    setNotice(null);
  }

  function handlePhoneChange(event: ChangeEvent<HTMLInputElement>) {
    setPhone(formatPhone(event.target.value));
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    const nextErrors: FieldErrors = {};


    if (!trimmedEmail) nextErrors.email = 'Informe seu e-mail.';
    else if (!EMAIL_PATTERN.test(trimmedEmail)) nextErrors.email = 'Informe um e-mail válido.';

    if (!password) nextErrors.password = 'Crie uma senha.';
    else if (password.length < MIN_PASSWORD_LENGTH)
      nextErrors.password = `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;

    if (!confirmPassword) nextErrors.confirmPassword = 'Repita a senha.';
    else if (confirmPassword !== password)
      nextErrors.confirmPassword = 'As senhas não coincidem.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      window.location.assign(APP_HOME);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setFormError(null);
    setNotice(null);
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      window.location.assign(APP_HOME);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const validation = validateBrazilianPhone(phone);
    if (!validation.valid || !validation.e164) {
      setErrors({ phone: validation.error ?? 'Informe um celular válido com DDD.' });
      return;
    }

    setSmsSending(true);
    try {
      if (!recaptchaReady.current) {
        initRecaptcha('recaptcha-container-register');
        recaptchaReady.current = true;
      }
      await sendVerificationCode(validation.e164);
      setPhoneStep('code');
      setNotice(`Código enviado para ${validation.formatted}.`);
    } catch (error) {
      setFormError(getPhoneAuthErrorMessage(error));
    } finally {
      setSmsSending(false);
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setCodeVerifying(true);
    try {
      await verifyCode(smsCode);
      window.location.assign(APP_HOME);
    } catch (error) {
      setFormError(getPhoneAuthErrorMessage(error));
    } finally {
      setCodeVerifying(false);
    }
  }

  const busy = submitting || googleLoading || smsSending || codeVerifying;

  if (loading && !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-6 text-brand-ink" />
          <p className="text-sm font-semibold text-muted-foreground">Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Goal className="size-5" />
            </span>
            <span className="text-lg font-black tracking-tight">Na Trave</span>
          </a>
          <Button
            render={<a href={LOGIN_PATH} />}
            variant="ghost"
            size="lg"
            className="h-10 px-3 font-semibold sm:px-4"
          >
            Entrar
          </Button>
        </div>
      </header>

      <main className="relative flex flex-1 items-center overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_minmax(380px,460px)] lg:items-center lg:gap-16 lg:px-8 lg:py-16">
          <section className="hidden flex-col justify-center lg:flex">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-brand-ink">
              <Sparkles className="size-3.5" />
              Bem-vindo ao time
            </span>
            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-[-.04em] xl:text-5xl">
              Crie sua conta.
              <span className="block text-brand-ink">Participe do fut da galera.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              Monte o elenco, sorteie times equilibrados e acompanhe placar, rankings e caixa com a
              cara do SofaScore.
            </p>
            <ul className="mt-8 space-y-3">
              {perks.map((perk) => (
                <li
                  key={perk}
                  className="flex items-start gap-3 text-sm font-semibold text-muted-foreground"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
            <a
              href="/"
              className="mt-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar para o início
            </a>
          </section>

          <Card className="w-full rounded-[26px] shadow-[0_24px_70px_rgba(10,25,14,.10)]">
            <CardHeader>
              <CardTitle className="text-2xl font-black tracking-tight">Criar conta</CardTitle>
              <CardDescription>Primeiro, sua conta. Depois, crie seu futebol ou entre com um código.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {formError ? (
                <Alert variant="destructive">
                  <AlertDescription className="font-semibold">{formError}</AlertDescription>
                </Alert>
              ) : null}

              {notice ? (
                <Alert className="border-primary/30 bg-primary/10">
                  <ShieldCheck className="text-brand-ink" />
                  <AlertDescription className="font-semibold text-foreground">
                    {notice}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Tabs
                value={method}
                onValueChange={(value) => handleMethodChange(value as Method)}
              >
                <TabsList className="grid h-10 w-full grid-cols-2">
                  <TabsTrigger value="email" className="h-8">
                    E-mail
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="h-8">
                    Telefone
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="mt-4">
                  <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="voce@email.com"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          if (errors.email)
                            setErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        disabled={busy}
                        className="h-11"
                      />
                      {errors.email ? (
                        <p id="email-error" className="text-xs font-medium text-destructive">
                          {errors.email}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••"
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (errors.password)
                            setErrors((prev) => ({ ...prev, password: undefined }));
                          if (errors.confirmPassword)
                            setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? 'password-error' : undefined}
                        disabled={busy}
                        className="h-11"
                      />
                      {errors.password ? (
                        <p id="password-error" className="text-xs font-medium text-destructive">
                          {errors.password}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password">Confirmar senha</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••"
                        value={confirmPassword}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value);
                          if (errors.confirmPassword)
                            setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }}
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={
                          errors.confirmPassword ? 'confirm-password-error' : undefined
                        }
                        disabled={busy}
                        className="h-11"
                      />
                      {errors.confirmPassword ? (
                        <p
                          id="confirm-password-error"
                          className="text-xs font-medium text-destructive"
                        >
                          {errors.confirmPassword}
                        </p>
                      ) : null}
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={busy}
                      className="h-11 w-full text-base font-semibold"
                    >
                      {submitting ? (
                        <>
                          <Spinner />
                          Criando conta…
                        </>
                      ) : (
                        'Criar conta'
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="phone" className="mt-4">
                  {phoneStep === 'phone' ? (
                    <form onSubmit={handlePhoneSubmit} noValidate className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone-register">Celular</Label>
                        <div className="flex items-stretch">
                          <span className="inline-flex items-center gap-1.5 rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm font-bold text-muted-foreground">
                            <Phone className="size-4" />
                            +55
                          </span>
                          <Input
                            id="phone-register"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            placeholder="(11) 99999-9999"
                            value={phone}
                            onChange={handlePhoneChange}
                            disabled={busy}
                            className="h-11 rounded-l-none"
                          />
                        </div>
                        {errors.phone ? (
                          <p className="text-xs font-medium text-destructive">{errors.phone}</p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Verificação de segurança</Label>
                        <div id="recaptcha-container-register" className="flex min-h-10 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-center">
                          <p className="text-xs font-semibold text-muted-foreground">Protegido por reCAPTCHA invisível.</p>
                        </div>
                      </div>
                      <Button type="submit" size="lg" disabled={busy} className="h-11 w-full text-base font-semibold">
                        {smsSending ? <><Spinner /> Enviando…</> : 'Receber código por SMS'}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleCodeSubmit} noValidate className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="sms-code-register">Código SMS</Label>
                        <Input
                          id="sms-code-register"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="000000"
                          maxLength={6}
                          value={smsCode}
                          onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          disabled={busy}
                          className="h-11 text-center text-lg font-bold tracking-[.3em]"
                        />
                      </div>
                      <Button type="submit" size="lg" disabled={busy || smsCode.length !== 6} className="h-11 w-full text-base font-semibold">
                        {codeVerifying ? <><Spinner /> Verificando…</> : 'Criar conta'}
                      </Button>
                      <Button type="button" variant="ghost" disabled={busy} onClick={() => { setPhoneStep('phone'); setSmsCode(''); }} className="h-10 w-full">
                        Trocar número
                      </Button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
                  ou
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className="h-11 w-full text-base font-semibold"
              >
                {googleLoading ? <Spinner /> : <GoogleIcon className="size-5" />}
                {googleLoading ? 'Conectando…' : 'Continuar com Google'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{' '}
                <a
                  href={LOGIN_PATH}
                  className="font-semibold text-brand-ink underline-offset-4 hover:underline"
                >
                  Entrar
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
