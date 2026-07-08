# Cash Hero — Panel Nauczyciela

Node.js + React (Vite) app, przygotowana do wdrożenia na Heroku.

## Struktura

- `client/` — aplikacja React (Vite + TypeScript + Tailwind CSS)
- `server/` — serwer Express serwujący zbudowaną aplikację kliencką
- `Procfile` — konfiguracja procesu dla Heroku

## Rozwój lokalny

```bash
npm install
npm run dev
```

Uruchomi to jednocześnie serwer Express (port 3001) i Vite dev server (port 5173, proxy `/api` do 3001).

## Build produkcyjny

```bash
npm run build
npm start
```

## Deploy na Heroku

```bash
heroku create nazwa-aplikacji
git push heroku main
```

Heroku automatycznie uruchomi `heroku-postbuild` (build klienta), a następnie `npm start`.
