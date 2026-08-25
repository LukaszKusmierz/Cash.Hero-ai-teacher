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

Uruchomi to jednocześnie serwer Express (port 3002) i Vite dev server (port 5173).
Port 3001 jest zarezerwowany dla lokalnej aplikacji ucznia (`Cash.Hero-ai`), dzięki
czemu oba frontendy mogą działać równocześnie bez konfliktu adresów.
Panel łączy się bezpośrednio z backendem Java. Skopiuj `client/.env.example`
do `client/.env` i ustaw `VITE_API_URL` na adres backendu (lokalnie domyślnie
`http://localhost:3000`). Origin panelu musi znajdować się w
`APP_CORS_ALLOWED_ORIGINS` backendu.

Panel korzysta z tego samego formatu sesji i kont co główny frontend Cash Hero.
Autoryzacja opiera się na bezpiecznym cookie `__Host-session`; panel nie zapisuje
tokenu sesyjnego w `localStorage`. Żądania zmieniające stan automatycznie pobierają
token z `GET /auth/csrf` i wysyłają go w nagłówku `X-XSRF-TOKEN` razem z cookies.
Obsługiwane dane lekcji pochodzą z endpointów pokojów, dashboardu nauczyciela
i historii gry; panel nie generuje uczestników ani wyników demonstracyjnych.

W produkcji panel i API muszą działać w tym samym kontekście site, np.
`teacher.cashhero.pl` oraz `api.cashhero.pl`, albo API musi być wystawione przez
reverse proxy panelu. Połączenie domen z różnych site (np. `herokuapp.com` i
`railway.app`) nie przeniesie cookie sesyjnego z `SameSite=Lax`.

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
