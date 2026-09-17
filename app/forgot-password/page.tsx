'use client';

import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ArrowLeft, Check, Goal, Mail, ShieldCheck, Sparkles } from 'lucide-react';

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
import { Spinner } from '@/components/ui/spinner';
import { auth } from '@/lib/firebase';

const LOGIN_PATH = '/login';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const perks: string[] = [
  'Escolha uma nova senha com segurança',
  'Link enviado direto para o seu e-mail',
  'Seus times, rankings e caixa continuam intactos',
];

function resetErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido. Confira o endereço digitado.';
    case 'auth/missing-email':
      return 'Informe seu e-mail.';
    case 'auth/user-not-found':
      return 'Não encontramos uma conta com este e-mail.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente em alguns instantes.';
    case 'auth/network-request-failed':
      return 'Falha de conexão. Verifique sua internet e tente de novo.';
    case 'auth/operation-not-allowed':
      return 'A recuperação de senha ainda não está habilitada.';
    default:
      return 'Não foi possível enviar o e-mail. Tente novamente.';
  }
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFieldError('Informe seu e-mail.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setFieldError('Informe um e-mail válido.');
      return;
    }

    setFieldError(null);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSentEmail(trimmedEmail);
    } catch (error) {
      setFormError(resetErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function handleUseAnotherEmail() {
    setSentEmail(null);
    setFormError(null);
    setFieldError(null);
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

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_minmax(380px,440px)] lg:items-center lg:gap-16 lg:px-8 lg:py-16">
          <section className="hidden flex-col justify-center lg:flex">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-brand-ink">
              <Sparkles className="size-3.5" />
              Recupere o acesso
            </span>
            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-[-.04em] xl:text-5xl">
              Esqueceu a senha?
              <span className="block text-brand-ink">A gente te coloca de volta no jogo.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha em
              poucos segundos.
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
              <CardTitle className="text-2xl font-black tracking-tight">Recuperar senha</CardTitle>
              <CardDescription>
                Enviaremos um link de redefinição para o seu e-mail.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {sentEmail ? (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-6 text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                      <ShieldCheck className="size-6" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      Enviamos um link de redefinição para{' '}
                      <span className="text-brand-ink">{sentEmail}</span>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Confira sua caixa de entrada e a pasta de spam. O link expira em pouco tempo.
                    </p>
                  </div>

                  <Button
                    render={<a href={LOGIN_PATH} />}
                    size="lg"
                    className="h-11 w-full text-base font-semibold"
                  >
                    Voltar para o login
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={handleUseAnotherEmail}
                    className="h-11 w-full font-semibold"
                  >
                    Usar outro e-mail
                  </Button>
                </div>
              ) : (
                <>
                  {formError ? (
                    <Alert variant="destructive">
                      <AlertDescription className="font-semibold">{formError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                          if (fieldError) setFieldError(null);
                        }}
                        aria-invalid={Boolean(fieldError)}
                        aria-describedby={fieldError ? 'email-error' : undefined}
                        disabled={submitting}
                        className="h-11"
                      />
                      {fieldError ? (
                        <p id="email-error" className="text-xs font-medium text-destructive">
                          {fieldError}
                        </p>
                      ) : null}
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={submitting}
                      className="h-11 w-full text-base font-semibold"
                    >
                      {submitting ? (
                        <>
                          <Spinner />
                          Enviando…
                        </>
                      ) : (
                        <>
                          <Mail className="size-4" />
                          Enviar link de recuperação
                        </>
                      )}
                    </Button>
                  </form>

                  <p className="text-center text-sm text-muted-foreground">
                    Lembrou a senha?{' '}
                    <a
                      href={LOGIN_PATH}
                      className="font-semibold text-brand-ink underline-offset-4 hover:underline"
                    >
                      Voltar para o login
                    </a>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
