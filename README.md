# Cash Hero — Panel Nauczyciela

Node.js + React (Vite) app, przygotowana do wdrożenia na Heroku.

## Struktura

- `client/` — aplikacja React (Vite + TypeScript + Tailwind CSS)
- `server/` — serwer Express serwujący zbudowaną aplikację kliencką
- `Procfile` — konfiguracja procesu dla Heroku

## Rozwój lokalny

```bash
npm install
npm install --prefix client
npm run dev
```

Uruchomi to jednocześnie serwer Express (port 3001) i Vite dev server (port 5173).
Panel łączy się bezpośrednio z backendem Java. Skopiuj `client/.env.example`
do `client/.env` i ustaw `VITE_API_URL` na adres backendu (lokalnie domyślnie
`http://localhost:8080`). Origin panelu musi znajdować się w
`APP_CORS_ALLOWED_ORIGINS` backendu.

Panel korzysta z tego samego formatu sesji i kont co główny frontend Cash Hero.
Obsługiwane dane lekcji pochodzą z endpointów pokojów, dashboardu nauczyciela
i historii gry; panel nie generuje uczestników ani wyników demonstracyjnych.

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
