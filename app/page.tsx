import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Goal,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  highlights: string[];
};

const features: Feature[] = [
  {
    icon: CalendarDays,
    title: 'Partidas',
    description:
      'Agende os jogos, monte os times com sorteio equilibrado e acompanhe do apito inicial ao placar final.',
    highlights: ['Times balanceados', 'Placar ao vivo', 'Súmula de lances'],
  },
  {
    icon: Activity,
    title: 'Estatísticas',
    description:
      'Gols, assistências, defesas e cartinhas com atributos. Cada lance registrado vira número.',
    highlights: ['Cartinhas FIFA', 'Gols e assistências', 'Defesas e notas'],
  },
  {
    icon: Trophy,
    title: 'Rankings',
    description:
      'Artilharia, assistências, paredões e mais vitórias em pódios que se atualizam sozinhos.',
    highlights: ['Artilheiros', 'Garçons', 'Paredões'],
  },
  {
    icon: CircleDollarSign,
    title: 'Mensalidades',
    description:
      'Controle o caixa do fut, marque quem pagou e saiba na hora quem ainda está pendente.',
    highlights: ['Caixa do fut', 'Status por jogador', 'Sem planilha'],
  },
];

const steps: Feature[] = [
  {
    icon: Users,
    title: 'Monte o elenco',
    description: 'Cadastre os jogadores com cartinhas, posições e atributos.',
    highlights: [],
  },
  {
    icon: Swords,
    title: 'Sorteie os times',
    description: 'Sorteio equilibrado por overall para jogos justos toda semana.',
    highlights: [],
  },
  {
    icon: Trophy,
    title: 'Acompanhe tudo',
    description: 'Placar ao vivo, rankings do mês e caixa sempre em dia.',
    highlights: [],
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Goal className="size-5" />
            </span>
            <span className="text-lg font-black tracking-tight">Na Trave</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex">
            <a className="transition hover:text-foreground" href="#recursos">
              Recursos
            </a>
            <a className="transition hover:text-foreground" href="#como-funciona">
              Como funciona
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              render={<a href="/login" />}
              variant="ghost"
              size="lg"
              className="h-10 px-3 font-semibold sm:px-4"
            >
              Entrar
            </Button>
            <Button render={<a href="/register" />} size="lg" className="h-10 px-3 font-semibold sm:px-4">
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-brand-ink">
                <Sparkles className="size-3.5" />
                SofaScore da várzea
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-.04em] sm:text-6xl lg:text-7xl">
                Na Trave
              </h1>
              <p className="mt-3 text-xl font-bold tracking-tight text-brand-ink sm:text-2xl">
                O placar do seu fut
              </p>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Partidas, estatísticas, rankings e mensalidades do futebol entre amigos, organizados em um só lugar
                com a cara do SofaScore.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  render={<a href="/register" />}
                  size="lg"
                  className="h-12 px-6 text-base font-semibold"
                >
                  Criar conta
                  <ChevronRight className="size-5" />
                </Button>
                <Button
                  render={<a href="/login" />}
                  variant="outline"
                  size="lg"
                  className="h-12 px-6 text-base font-semibold"
                >
                  Entrar
                </Button>
              </div>
              <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                    Jogadores
                  </dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums">10+</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                    Estatísticas
                  </dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums">100%</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                    Planilhas
                  </dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums">0</dd>
                </div>
              </dl>
            </div>

            <div className="relative">
              <div className="relative rounded-[28px] border border-line-inverse bg-surface-inverse p-5 text-ink-inverse shadow-[0_30px_90px_rgba(10,25,14,.28)] sm:p-7">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-white">
                    <span className="size-1.5 animate-pulse rounded-full bg-white" />
                    Ao vivo
                  </span>
                  <small className="text-xs font-semibold text-ink-inverse-soft">Rodada de quinta</small>
                  <i className="ml-auto text-xs font-semibold not-italic text-ink-inverse-faint">2º tempo</i>
                </div>
                <div className="my-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                  <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-end sm:text-right">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-black text-primary-foreground">
                      CA
                    </span>
                    <b className="text-sm font-bold">Camaradas</b>
                  </div>
                  <strong className="flex items-center gap-2 text-4xl font-black tabular-nums tracking-tighter sm:text-5xl">
                    3
                    <i className="text-lg not-italic text-ink-inverse-faint sm:text-2xl">x</i>
                    2
                  </strong>
                  <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                    <b className="text-sm font-bold">Resenha FC</b>
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-sm font-black text-ink-inverse">
                      RF
                    </span>
                  </div>
                </div>
                <div className="space-y-2 border-t border-line-inverse pt-4">
                  <div className="flex items-center gap-3 rounded-xl bg-white/[.05] px-3 py-2 text-xs">
                    <Goal className="size-4 text-primary" />
                    <b className="min-w-0 flex-1 truncate font-semibold">Rafinha</b>
                    <small className="text-ink-inverse-faint">2 gols</small>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/[.05] px-3 py-2 text-xs">
                    <ShieldCheck className="size-4 text-primary" />
                    <b className="min-w-0 flex-1 truncate font-semibold">Diego</b>
                    <small className="text-ink-inverse-faint">4 defesas</small>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/[.05] px-3 py-2 text-xs">
                    <Trophy className="size-4 text-primary" />
                    <b className="min-w-0 flex-1 truncate font-semibold">Artilharia do mês</b>
                    <small className="text-ink-inverse-faint">Rafinha</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-t border-border bg-surface-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <span className="eyebrow-muted">Recursos</span>
              <h2 className="mt-2 text-3xl font-black tracking-[-.03em] sm:text-4xl">Tudo que o fut precisa</h2>
              <p className="mt-3 text-muted-foreground">
                Do sorteio dos times ao caixa no fim do mês. Sem planilha, sem grupo bagunçado.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="group flex h-full flex-col rounded-[22px] border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-black tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
                    {feature.highlights.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Check className="size-3.5 shrink-0 text-brand-ink" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <span className="eyebrow-muted">Como funciona</span>
              <h2 className="mt-2 text-3xl font-black tracking-[-.03em] sm:text-4xl">Pronto em três passos</h2>
            </div>
            <ol className="mt-12 grid gap-5 sm:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-[22px] border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                      <step.icon className="size-5" />
                    </span>
                    <span className="text-xs font-black tabular-nums text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-black tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[28px] border border-line-inverse bg-surface-inverse px-6 py-12 text-center text-ink-inverse sm:px-10 sm:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/15 blur-3xl"
              />
              <div className="relative mx-auto max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-primary">
                  <Sparkles className="size-3.5" />
                  Bora organizar o fut
                </span>
                <h2 className="mt-5 text-3xl font-black tracking-[-.03em] sm:text-4xl">
                  Chame a galera e comece agora
                </h2>
                <p className="mt-3 text-sm text-ink-inverse-soft sm:text-base">
                  Crie sua conta em segundos e deixe o Na Trave cuidar do placar, do ranking e do caixa.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button
                    render={<a href="/register" />}
                    size="lg"
                    className="h-12 px-6 text-base font-semibold"
                  >
                    Criar conta
                    <ChevronRight className="size-5" />
                  </Button>
                  <Button
                    render={<a href="/login" />}
                    variant="outline"
                    size="lg"
                    className="h-12 border-line-inverse bg-transparent px-6 text-base font-semibold text-ink-inverse hover:bg-white/10 hover:text-ink-inverse"
                  >
                    Entrar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Goal className="size-4" />
            </span>
            <b className="font-black tracking-tight text-foreground">Na Trave</b>
          </div>
          <p className="text-xs">Feito para o futebol da galera.</p>
          <nav className="flex items-center gap-5 text-xs font-semibold">
            <a className="transition hover:text-foreground" href="/login">
              Entrar
            </a>
            <a className="transition hover:text-foreground" href="/register">
              Criar conta
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
