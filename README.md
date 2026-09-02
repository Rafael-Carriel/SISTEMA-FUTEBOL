# NA TRAVE — Sistema de Futebol da Galera ⚽

> **SofaScore da várzea** — Gestão completa para o futebol entre amigos. Placar ao vivo, cartinhas FIFA, rankings, mensalidades e artes para o WhatsApp.

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-baFF55?style=for-the-badge)
![Stack](https://img.shields.io/badge/stack-React%2019%20%2B%20Firebase-07100b?style=flat)
![License](https://img.shields.io/badge/license-MIT-green)

**Projeto:** `na-trave-fut-2026` | **Stack:** React 19 + Vite + Firebase Firestore + Tailwind 4 + shadcn/ui | **Deploy:** Firebase Hosting

---

## ✨ Funcionalidades

- **Dashboard** — Placar ao vivo + artilharia do mês + caixa
- **Partidas** — Criação com sorteio equilibrado por overall, controle `agendado → ao vivo → encerrado`, registro de gols/defesas com assistência
- **Jogadores** — Cartinhas com 5 atributos (pace/shooting/passing/defending/physical), foto e overall
- **Rankings** — Artilheiros, assistências, paredões e mais vitórias
- **Mensalidades** — Controle mensal R$ 40/jogador
- **Artes** — Gerador de artes 1080x1350 para Instagram/WhatsApp

## 🚀 Começando

```bash
# Instalar
npm install

# Dev (Vite)
npm run dev

# Build
npm run build

# Lint
npm run lint
```

Configure o Firebase em `lib/firebase.ts` (já apontado para `na-trave-fut-2026`).

## 🗂️ Estrutura

```
components/fut-app.tsx  # App principal (6 views)
lib/fut-types.ts        # Types: Player, Match, MatchEvent, Payment
lib/demo-data.ts        # Dados demo (10 jogadores + 2 partidas)
lib/firebase.ts         # Firestore realtime
app/page.tsx            # Entry Next
```

## 🌿 Fluxo Git Profissional

- `main` — produção (protegida)
- `develop` — integração
- `feat/*` — features
- Commits semânticos: `feat:`, `fix:`, `chore:`, `docs:`
- Tags `v0.x.x` para releases

```bash
git checkout -b feat/minha-feature
# ... codar ...
git commit -m "feat: minha feature"
git push -u origin feat/minha-feature
# -> abrir Pull Request para develop -> main
```

## 🛣️ Roadmap — Rumo ao SofaScore da Várzea

- [ ] Campo tático com escalação por posição (GOL/ZAG/MEI/ATA)
- [ ] Sorteio snake-draft balanceado por atributos (overall + pace etc)
- [ ] Rankings estilo pódio SofaScore
- [ ] Artes com upload de foto do dispositivo + preview
- [ ] Timeline de partida minuto-a-minuto
- [ ] Notas/ratings por partida
- [ ] Temporadas e H2H

---

Feito com 💚 para o **Fut das Quintas**
