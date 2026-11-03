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
Port 3001 jest zarezerwowany dla aplikacji ucznia z sąsiedniego repozytorium
`Cash.Hero` na gałęzi `new_way_lk`. Zainstaluj w nim zależności przed uruchomieniem
`npm run dev` panelu. Obie aplikacje korzystają z `CH-teacher_module_java/develop`.
Ustaw w obu `VITE_API_URL` na ten sam adres backendu (domyślnie
`http://localhost:8080`). Dodaj oba originy do `APP_CORS_ALLOWED_ORIGINS`
i używaj hosta `localhost`. Do równoległego logowania ucznia i nauczyciela
użyj osobnych profili lub kontekstów przeglądarki.

Panel korzysta z tego samego formatu sesji i kont co główny frontend Cash Hero.
Autoryzacja opiera się na bezpiecznym cookie `__Host-session`; panel nie zapisuje
tokenu sesyjnego w `localStorage`. Żądania zmieniające stan automatycznie pobierają
token z `GET /auth/csrf` i wysyłają go w nagłówku `X-XSRF-TOKEN` razem z cookies.
Podgląd odświeża dashboard lekcji, gdy karta jest widoczna. Raport ucznia
otwiera konkretną próbę i pobiera starsze zdarzenia stronami. Nowy scenariusz
84-dniowy pokazuje sześć okresów. Starsze próby zachowują postęp w dniach.
Przejście z poczekalni do podglądu zmienia widok nauczyciela. Uczeń rozpoczyna
próbę po wybraniu postaci i mieszkania.

Rejestracja nauczyciela wymaga jednorazowego kodu zaproszenia i korzysta z
`POST /auth/teacher-invitations/accept`. Jeśli administrator przypisał zaproszenie
do adresu e-mail, ten sam adres trzeba podać w formularzu rejestracji. Adres e-mail
jest wymagany przy tworzeniu zaproszenia i rejestracji. Login i e-mail muszą być
wolne; odpowiedź HTTP 409 oznacza konflikt z istniejącym kontem. W takiej sytuacji
należy zalogować się na istniejące konto nauczyciela, wybrać inny login lub
skontaktować się z administratorem, jeśli e-mail jest już zajęty. Konto
`ADMIN` otwiera w tym module panel tworzenia i unieważniania zaproszeń oraz listę
powiadomień o utworzonych kontach nauczycieli. Kod trafia wyłącznie do wiadomości
e-mail; API nie zwraca go do panelu. Panel pokazuje adresata, termin ważności
i status wysyłki, który można odświeżyć. Kod nie jest zapisywany w adresie URL.

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
