import React, { useState, useEffect } from "react";
import {
  Play, Pause, Square, Users, Wallet, AlertTriangle, Activity,
  BookOpen, X, Search, ChevronRight, ArrowLeft, Trophy, ShieldAlert,
  CheckCircle2, BarChart3, FileText, Loader2, Copy, Check,
  Radio, GraduationCap, Flag, Clock, RefreshCw,
  TrendingUp, TrendingDown, Brain, HeartPulse, Rocket, CreditCard,
  ShieldCheck, Target, Scale, LifeBuoy, PartyPopper, LayoutGrid,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* HELPERS — PRNG / kod pokoju / mockowy kod QR                         */
/* ------------------------------------------------------------------ */

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
function randomRoomCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// Wizualny odpowiednik kodu QR — bez realnej biblioteki QR w tym środowisku,
// generujemy deterministyczny (na podstawie kodu pokoju) wzór przypominający
// prawdziwy kod, z trzema "znacznikami pozycji" jak w rzeczywistym QR.
function buildQrMatrix(seed, size = 21) {
  const rand = mulberry32(hashString(seed));
  const m = Array.from({ length: size }, () => Array(size).fill(false));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      m[r][c] = rand() > 0.55;
    }
  }
  const drawFinder = (or, oc) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[or + r][oc + c] = isBorder || isInner;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  return m;
}

const ROTATE_SECONDS = 180;

/* ------------------------------------------------------------------ */
/* MOCK DATA — w docelowej wersji podmienione na dane z bazy danych    */
/* ------------------------------------------------------------------ */

const TOTAL_DAYS = 28;

const DECISION_POINTS = [
  {
    day: 3,
    title: "Zepsuta pralka",
    scenario: "Pralka odmawia posłuszeństwa tydzień przed wypłatą.",
    options: [
      { label: "Naprawa u fachowca", budgetChange: -150, stressChange: -5, result: "Pralka naprawiona jednorazowym wydatkiem — budżet ucierpiał, ale problem zniknął." },
      { label: "Kupno nowej na raty", budgetChange: -50, stressChange: 10, result: "Rata za nowy sprzęt obciąża budżet w kolejnych tygodniach gry." },
      { label: "Pranie ręczne / u sąsiada", budgetChange: 0, stressChange: 15, result: "Zaoszczędzono pieniądze, ale rośnie zmęczenie i frustracja." },
    ],
  },
  {
    day: 6,
    title: "Oferta dorywczej pracy",
    scenario: "Znajomy proponuje dodatkową zmianę w weekend.",
    options: [
      { label: "Dodatkowa zmiana w pracy", budgetChange: 200, stressChange: 20, result: "Większy budżet, ale zauważalnie mniej czasu na odpoczynek." },
      { label: "Odmowa, odpoczynek", budgetChange: 0, stressChange: -10, result: "Brak dodatkowego dochodu, za to spadek poziomu stresu." },
    ],
  },
  {
    day: 9,
    title: "Zaproszenie na wakacje",
    scenario: "Znajomi planują wspólny wyjazd już w ten weekend.",
    options: [
      { label: "Wyjazd na kartę kredytową", budgetChange: -400, stressChange: 25, result: "Zadłużenie na karcie zaczyna ciążyć na kolejnych decyzjach." },
      { label: "Wyjazd z ustalonym budżetem", budgetChange: -150, stressChange: 5, result: "Udany wyjazd bez nadmiernych wydatków." },
      { label: "Rezygnacja, oszczędzanie", budgetChange: 50, stressChange: 10, result: "Oszczędności rosną, ale pojawia się poczucie odizolowania od grupy." },
    ],
  },
  {
    day: 12,
    title: "Promocja -50% na elektronikę",
    scenario: "Ulubiony sklep ogłasza wyprzedaż elektroniki.",
    options: [
      { label: "Nowy telefon w promocji", budgetChange: -300, stressChange: 5, result: "Impulsywny zakup wyraźnie nadszarpnął budżet." },
      { label: "Zignorowanie promocji", budgetChange: 0, stressChange: -5, result: "Budżet bezpieczny, stary sprzęt nadal działa." },
      { label: "Tańszy zamiennik z listy", budgetChange: -80, stressChange: 0, result: "Rozsądny kompromis między potrzebą a oszczędnością." },
    ],
  },
  {
    day: 15,
    title: "Awaria roweru",
    scenario: "Rower — jedyny środek transportu do pracy — psuje się rano.",
    options: [
      { label: "Zakup nowego roweru", budgetChange: -350, stressChange: 5, result: "Wygodny dojazd, ale spory jednorazowy wydatek." },
      { label: "Naprawa starego roweru", budgetChange: -80, stressChange: 0, result: "Tani i szybki powrót do formy." },
      { label: "Przesiadka na komunikację miejską", budgetChange: -40, stressChange: 15, result: "Oszczędność, ale dłuższy i bardziej męczący dojazd." },
    ],
  },
];

// Progres demonstracyjny dla uczniów widocznych już na ekranie "Pokój Nauczyciela"
const DEMO_PROGRESS = {
  Robert: { day: 15, budget: 1200, stress: 15, status: "w_grze", choices: [0, 1, 1, 1, 1] },
  Michał: { day: 14, budget: 850, stress: 20, status: "w_grze", choices: [0, 0, 1, 2] },
  Zuzia: { day: 14, budget: 600, stress: 45, status: "w_grze", choices: [1, 0, 1, 0] },
  Franek: { day: 14, budget: 420, stress: 80, status: "w_grze", choices: [2, 0, 0, 0] },
  Sylwia: { day: 12, budget: -50, stress: 95, status: "bankrut", choices: [1, 0, 0, 0] },
  Julka: { day: 10, budget: 300, stress: 55, status: "w_grze", choices: [0, 0, 1] },
  Zosia: { day: 8, budget: 150, stress: 30, status: "w_grze", choices: [0, 1] },
};

// Dla uczniów spoza listy demo (dodanych ręcznie przez nauczyciela) generujemy
// spójny progres na podstawie tych samych punktów decyzyjnych.
function generateProgressForName(name) {
  const rand = mulberry32(hashString(`${name}-progress`));
  const day = 5 + Math.floor(rand() * 16);
  const pointsReached = DECISION_POINTS.filter((p) => p.day <= day).length;
  const choices = Array.from({ length: pointsReached }, (_, i) => Math.floor(rand() * DECISION_POINTS[i].options.length));
  let budget = 1000;
  let stress = 10;
  choices.forEach((optIdx, i) => {
    const opt = DECISION_POINTS[i].options[optIdx];
    budget += opt.budgetChange;
    stress = Math.min(100, Math.max(0, stress + opt.stressChange));
  });
  return { day, budget, stress, status: budget < 0 ? "bankrut" : "w_grze", choices };
}

function getProgress(name) {
  return DEMO_PROGRESS[name] || generateProgressForName(name);
}

const INITIAL_PARTICIPANTS = [
  { id: 1, name: "Zuzia", device: 1 },
  { id: 2, name: "Michał", device: 2 },
  { id: 3, name: "Robert", device: 3 },
  { id: 4, name: "Franek", device: 4 },
  { id: 5, name: "Sylwia", device: 5 },
  { id: 6, name: "Julka", device: 6 },
  { id: 7, name: "Zosia", device: 7 },
];

const LIBRARY_CATEGORIES = [
  { id: "budzet", name: "Budżet i Oszczędzanie", icon: Wallet, bg: "bg-green-50", text: "text-green-600", ring: "ring-green-200" },
  { id: "inwestycje", name: "Inwestycje", icon: TrendingUp, bg: "bg-indigo-50", text: "text-indigo-600", ring: "ring-indigo-200" },
  { id: "kredyty", name: "Kredyty i Zadłużenie", icon: CreditCard, bg: "bg-red-50", text: "text-red-600", ring: "ring-red-200" },
  { id: "psychika", name: "Zdrowie Psychiczne", icon: Brain, bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200" },
  { id: "fizyka", name: "Zdrowie Fizyczne", icon: HeartPulse, bg: "bg-purple-50", text: "text-purple-600", ring: "ring-purple-200" },
  { id: "rozwoj", name: "Rozwój Osobisty", icon: Rocket, bg: "bg-orange-50", text: "text-orange-600", ring: "ring-orange-200" },
  { id: "bezpieczenstwo", name: "Bezpieczeństwo Finansowe", icon: ShieldCheck, bg: "bg-teal-50", text: "text-teal-600", ring: "ring-teal-200" },
];

const LIBRARY_ARTICLES = [
  {
    id: 1, category: "budzet", title: "Jak zbudować budżet domowy", readTime: "4 min",
    summary: "Zasada 50/30/20 jako punkt wyjścia: potrzeby, zachcianki i oszczędności rozdzielone tak, by żadna kategoria nie zjadała reszty pod koniec miesiąca.",
    gameLinks: [
      { context: "decision", pointIndex: 2, optionIndex: 1, tip: "Uczeń, który wybrał wyjazd z ustalonym budżetem, praktycznie zastosował planowanie wydatków — dobra okazja, by odnieść to do zasady 50/30/20." },
      { context: "decision", pointIndex: 3, optionIndex: 2, tip: "Wybór tańszego zamiennika to przykład świadomego planowania wydatków zgodnego z założonym budżetem." },
    ],
  },
  {
    id: 2, category: "budzet", title: "Fundusz awaryjny — dlaczego jest ważny", readTime: "3 min",
    summary: "Poduszka finansowa na 3–6 miesięcy wydatków chroni przed sięganiem po kredyt w chwilach takich jak zepsuta pralka czy awaria roweru.",
    gameLinks: [
      { context: "decision", pointIndex: 0, optionIndex: 0, tip: "Nagły wydatek na naprawę pralki to podręcznikowy przypadek na fundusz awaryjny — zapytaj, czy uczeń miał odłożone pieniądze na taką sytuację." },
      { context: "decision", pointIndex: 4, optionIndex: 1, tip: "Kolejna nieplanowana awaria w grze — dobry moment, by uczniowie zauważyli powtarzający się wzorzec nieprzewidzianych wydatków." },
    ],
  },
  {
    id: 3, category: "budzet", title: "Jak ograniczyć impulsywne zakupy", readTime: "3 min",
    summary: "Reguła 24 godzin przed większym zakupem, lista zakupów i unikanie promocji 'tylko dziś' pomagają odróżnić prawdziwą potrzebę od chwilowej zachcianki.",
    gameLinks: [
      { context: "decision", pointIndex: 3, optionIndex: 0, tip: "Klasyczny impulsywny zakup pod wpływem promocji — zapytaj ucznia, czy telefon był faktycznie potrzebny, czy to była zachcianka." },
    ],
  },
  {
    id: 4, category: "inwestycje", title: "Podstawy inwestowania na GPW", readTime: "6 min",
    summary: "Czym różni się akcja od obligacji, jak czytać notowania i dlaczego horyzont czasowy zmienia poziom akceptowalnego ryzyka.",
    gameLinks: [
      { context: "general", label: "Przed wejściem w Moduł Inwestycyjny", tip: "Dobry temat na wprowadzenie, zanim uczniowie wybiorą Moduł Inwestycyjny na ekranie wyboru modułu." },
      { context: "report", label: "Raport końcowy — Wynik inwestycji", tip: "Omów z uczniem, dlaczego wybrał dany instrument i czy rozumie różnicę między akcją a obligacją." },
    ],
  },
  {
    id: 5, category: "inwestycje", title: "Dywersyfikacja portfela", readTime: "4 min",
    summary: "Nie wkładaj wszystkich oszczędności w jeden instrument — rozłożenie ryzyka na różne klasy aktywów łagodzi wahania wartości portfela.",
    gameLinks: [
      { context: "report", label: "Raport końcowy — Wynik inwestycji", tip: "Jeśli uczeń zainwestował całą kwotę w jeden instrument, to naturalny moment na rozmowę o dywersyfikacji." },
    ],
  },
  {
    id: 6, category: "inwestycje", title: "Obligacje skarbowe — bezpieczna przystań", readTime: "3 min",
    summary: "Niższy potencjalny zysk w zamian za wyższe bezpieczeństwo — dobry punkt startowy dla początkujących inwestorów.",
    gameLinks: [
      { context: "report", label: "Raport końcowy — Wynik inwestycji", tip: "Dobry punkt odniesienia przy porównaniu z ryzykownym wynikiem inwestycji w kryptowaluty." },
    ],
  },
  {
    id: 7, category: "inwestycje", title: "Psychologia inwestowania", readTime: "5 min",
    summary: "Strach i euforia to najczęstsi wrogowie inwestora — decyzje podjęte pod wpływem emocji rzadko okazują się racjonalne.",
    gameLinks: [
      { context: "report", label: "Raport końcowy — Wynik inwestycji", tip: "Gdy wynik inwestycji jest bardzo dobry lub bardzo zły, zapytaj, czy decyzja o kwocie i momencie była przemyślana, czy emocjonalna." },
    ],
  },
  {
    id: 8, category: "inwestycje", title: "Kryptowaluty — szanse i zagrożenia", readTime: "5 min",
    summary: "Wysoka zmienność oznacza możliwość szybkiego zysku, ale równie szybkiej straty. Kluczowa zasada: nigdy nie inwestuj pieniędzy, których utrata zachwiałaby budżetem.",
    gameLinks: [
      { context: "report", label: "Raport końcowy — Wynik inwestycji", tip: "Wykorzystaj bezpośrednio przy sekcji 'Wynik inwestycji', jeśli uczeń wybrał kryptowaluty." },
    ],
  },
  {
    id: 9, category: "kredyty", title: "Pułapka kredytów konsumenckich", readTime: "5 min",
    summary: "Raty i karty kredytowe potrafią odroczyć problem, ale rzadko go rozwiązują — realny koszt kredytu bywa dużo wyższy niż się wydaje.",
    gameLinks: [
      { context: "decision", pointIndex: 0, optionIndex: 1, tip: "Rata za nowy sprzęt to najprostszy przykład kredytu konsumenckiego w grze — dobry moment na to zagadnienie." },
      { context: "decision", pointIndex: 2, optionIndex: 0, tip: "Wyjazd sfinansowany kartą kredytową to okazja, by pokazać realny, odroczony koszt takiego zadłużenia." },
    ],
  },
  {
    id: 10, category: "kredyty", title: "Jak działają odsetki i RRSO", readTime: "4 min",
    summary: "Rzeczywista Roczna Stopa Oprocentowania pokazuje pełny koszt kredytu łącznie z prowizjami i ubezpieczeniami — dobry punkt odniesienia przy porównywaniu ofert.",
    gameLinks: [
      { context: "decision", pointIndex: 0, optionIndex: 1, tip: "Zapytaj, czy uczeń sprawdziłby RRSO oferty ratalnej przed podjęciem takiej decyzji." },
    ],
  },
  {
    id: 11, category: "kredyty", title: "Karty kredytowe: korzyści i pułapki", readTime: "4 min",
    summary: "Spłata w terminie bezodsetkowym to realna korzyść, ale minimalna rata i odraczanie spłaty potrafią zamienić wygodę w spiralę zadłużenia.",
    gameLinks: [
      { context: "decision", pointIndex: 2, optionIndex: 0, tip: "Najbardziej bezpośrednie powiązanie w całej grze — świetny moment, by sięgnąć po ten artykuł." },
    ],
  },
  {
    id: 12, category: "psychika", title: "Stres finansowy a zdrowie psychiczne", readTime: "4 min",
    summary: "Chroniczny niepokój o pieniądze wpływa na sen, koncentrację i relacje — rozpoznanie tego mechanizmu to pierwszy krok do lepszych decyzji.",
    gameLinks: [
      { context: "decision", pointIndex: 1, optionIndex: 0, tip: "Wybór dodatkowej zmiany kosztem odpoczynku to dobra okazja, by omówić związek między nadmierną pracą a stresem." },
      { context: "report", label: "Raport końcowy — wskaźnik Zdrowie psychiczne", tip: "Użyj przy omawianiu wskaźnika zdrowia psychicznego w raporcie, szczególnie gdy wynik jest niski." },
    ],
  },
  {
    id: 13, category: "psychika", title: "Jak dbać o siebie pod presją", readTime: "3 min",
    summary: "Krótkie przerwy, rozmowa z bliską osobą i realistyczne oczekiwania wobec siebie pomagają utrzymać równowagę w trudnych tygodniach.",
    gameLinks: [
      { context: "decision", pointIndex: 1, optionIndex: 1, tip: "Uczeń, który wybrał odpoczynek zamiast dodatkowej pracy, podjął decyzję prozdrowotną — warto to docenić i rozwinąć temat." },
    ],
  },
  {
    id: 14, category: "fizyka", title: "Aktywność fizyczna a produktywność", readTime: "3 min",
    summary: "Nawet 20 minut ruchu dziennie poprawia koncentrację i jakość podejmowanych decyzji, w tym tych finansowych.",
    gameLinks: [
      { context: "decision", pointIndex: 4, optionIndex: 2, tip: "Rezygnacja z roweru na rzecz komunikacji miejskiej to okazja, by wspomnieć, jak aktywność fizyczna wspiera samopoczucie." },
      { context: "report", label: "Raport końcowy — wskaźnik Zdrowie fizyczne", tip: "Wykorzystaj przy niskim wyniku wskaźnika zdrowia fizycznego w raporcie." },
    ],
  },
  {
    id: 15, category: "fizyka", title: "Sen i regeneracja a decyzje finansowe", readTime: "3 min",
    summary: "Niewyspany mózg chętniej sięga po łatwe, impulsywne rozwiązania — regularny sen to niedoceniane narzędzie zarządzania budżetem.",
    gameLinks: [
      { context: "decision", pointIndex: 1, optionIndex: 0, tip: "Dodatkowa zmiana kosztem odpoczynku to dobry punkt wyjścia do rozmowy o wpływie snu na jakość decyzji." },
    ],
  },
  {
    id: 16, category: "rozwoj", title: "Inwestowanie w siebie — nauka i kursy", readTime: "4 min",
    summary: "Nowe umiejętności zwiększają przyszłe zarobki bardziej niezawodnie niż niejedna inwestycja giełdowa — edukacja to część portfela.",
    gameLinks: [
      { context: "report", label: "Raport końcowy — wskaźnik Rozwój osobisty", tip: "Świetny temat, gdy wynik wskaźnika rozwoju osobistego jest niski w raporcie końcowym." },
    ],
  },
  {
    id: 17, category: "rozwoj", title: "Budowanie nowych umiejętności — mikro-kroki", readTime: "3 min",
    summary: "Małe, regularne kroki (15 minut dziennie) skuteczniej budują nawyk nauki niż rzadkie, długie sesje.",
    gameLinks: [
      { context: "report", label: "Raport końcowy — sekcja Kluczowe Wnioski", tip: "Zaproponuj jako konkretny plan działania po zakończeniu gry, niezależnie od uzyskanego wyniku." },
    ],
  },
  {
    id: 18, category: "bezpieczenstwo", title: "Poduszka finansowa — ile odłożyć?", readTime: "3 min",
    summary: "Rekomendowane 3–6 miesięcy wydatków to punkt docelowy, ale każda odłożona złotówka realnie zmniejsza ryzyko — zacznij od małych, regularnych wpłat.",
    gameLinks: [
      { context: "decision", pointIndex: 2, optionIndex: 2, tip: "Uczeń, który zrezygnował z wyjazdu na rzecz oszczędzania, zaczął realnie budować własną poduszkę — warto to pochwalić." },
      { context: "report", label: "Raport końcowy — Oszczędności końcowe", tip: "Bezpośrednio nawiązuje do pola 'Oszczędności końcowe' w Podsumowaniu Decyzji Finansowych." },
    ],
  },
  {
    id: 19, category: "bezpieczenstwo", title: "Ochrona przed oszustwami finansowymi", readTime: "4 min",
    summary: "Presja czasu i obietnica 'gwarantowanego' zysku to najczęstsze sygnały ostrzegawcze — warto zawsze zweryfikować źródło przed decyzją.",
    gameLinks: [
      { context: "general", label: "Wprowadzenie do lekcji", tip: "Dobry temat na start lekcji jako ogólne wprowadzenie do bezpiecznego korzystania z pieniędzy, niezależnie od konkretnej decyzji w grze." },
    ],
  },
];

const TALKING_POINTS = {
  "0-1": "Rata za nowy sprzęt pozornie odciąża budżet, ale rozkłada koszt w czasie — dobry przykład na temat 'małe raty, duży problem'.",
  "1-0": "Dodatkowy dochód kosztem czasu wolnego — warto zapytać, czy uczeń zauważył wzrost stresu w kolejnych dniach.",
  "2-0": "Karta kredytowa daje natychmiastową gratyfikację, ale odracza koszt — dobry moment na rozmowę o realnym oprocentowaniu zadłużenia.",
  "3-0": "Zakup pod wpływem promocji — warto zapytać ucznia, czy telefon był realną potrzebą, czy impulsem.",
  "4-0": "Nowy rower zamiast naprawy starego — okazja do rozmowy o różnicy między 'chcę' a 'muszę'.",
};

/* ------------------------------------------------------------------ */
/* GENEROWANIE ROZBUDOWANEGO RAPORTU KOŃCOWEGO UCZNIA                   */
/* ------------------------------------------------------------------ */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function levelMeta(v) {
  if (v < 35) return { statusLabel: "Krytycznie niski", statusColor: "red" };
  if (v < 60) return { statusLabel: "Wymaga uwagi", statusColor: "amber" };
  return { statusLabel: "Dobry poziom", statusColor: "green" };
}

const IMPROVEMENT_COPY = {
  psychika: { title: "Zdrowie psychiczne", icon: Brain, issue: "Zbyt niski poziom zdrowia psychicznego", recommendation: "Zadbaj o relaks, przyjaciół i hobby. Unikaj nadmiernych wydatków i stresu finansowego." },
  fizyka: { title: "Zdrowie fizyczne", icon: HeartPulse, issue: "Niedostateczna aktywność fizyczna", recommendation: "Inwestuj w aktywność fizyczną, zdrowe jedzenie i regularny sen." },
  rozwoj: { title: "Rozwój osobisty", icon: Rocket, issue: "Brak wystarczającego rozwoju kompetencji", recommendation: "Poświęć więcej czasu na naukę, kursy i rozwijanie umiejętności." },
  finanse: { title: "Status finansowy", icon: Wallet, issue: "Zbyt niski poziom oszczędności", recommendation: "Ogranicz zbędne wydatki i regularnie odkładaj część dochodu na fundusz awaryjny." },
};

function buildStudentReport(student) {
  const rand = mulberry32(hashString(`${student.name}-report-v2`));

  const financeChange = student.budget;
  const finalPsychika = clamp(100 - student.stress, 0, 100);
  const psychikaChange = finalPsychika - 50;

  const finalFizyka = clamp(Math.round(50 + (rand() - 0.5) * 90), 0, 100);
  const fizykaChange = finalFizyka - 50;

  const finalRozwoj = clamp(Math.round(50 + (rand() - 0.5) * 70), 0, 100);
  const rozwojChange = finalRozwoj - 50;

  const financeScore = clamp(Math.round(50 + financeChange / 50), 0, 100);
  const overallScore = clamp(
    Math.round(0.4 * financeScore + 0.3 * finalPsychika + 0.15 * finalFizyka + 0.15 * finalRozwoj),
    0,
    100
  );

  const tier =
    overallScore >= 80 ? "great" : overallScore >= 60 ? "good" : overallScore >= 40 ? "needs_work" : "critical";

  const TIER_META = {
    great: { label: "Świetny wynik", title: "Gratulacje!", desc: "Doskonała równowaga między finansami a życiem osobistym.", icon: PartyPopper, glow: "border-green-300" },
    good: { label: "Dobry wynik", title: "Dobra robota!", desc: "Solidne podstawy — jest jeszcze kilka obszarów do dopracowania.", icon: TrendingUp, glow: "border-indigo-300" },
    needs_work: { label: "Wymaga poprawy", title: "Podsumowanie rozgrywki", desc: "Konieczna poprawa strategii zarządzania budżetem i życiem.", icon: AlertTriangle, glow: "border-amber-300" },
    critical: { label: "Wynik krytyczny", title: "Podsumowanie rozgrywki", desc: "Kilka decyzji finansowych wymaga dogłębnej analizy — to dobry materiał do rozmowy.", icon: AlertTriangle, glow: "border-red-300" },
  }[tier];

  const savings = Math.max(financeChange, 0);
  const savingsLabel =
    savings >= 1000 ? "Świetna poduszka" : savings >= 300 ? "Podstawowa poduszka" : savings > 0 ? "Minimalna poduszka" : "Brak poduszki";

  const indicators = [
    { key: "psychika", label: "Zdrowie psychiczne", icon: Brain, display: `${finalPsychika}%`, barPct: finalPsychika, ...levelMeta(finalPsychika) },
    { key: "fizyka", label: "Zdrowie fizyczne", icon: HeartPulse, display: `${finalFizyka}%`, barPct: finalFizyka, ...levelMeta(finalFizyka) },
    { key: "rozwoj", label: "Rozwój osobisty", icon: Rocket, display: `${finalRozwoj}%`, barPct: finalRozwoj, ...levelMeta(finalRozwoj) },
    {
      key: "finanse",
      label: "Status finansowy",
      icon: Wallet,
      display: `${savings} zł`,
      barPct: clamp(Math.round((savings / 2000) * 100), 4, 100),
      statusLabel: savingsLabel,
      statusColor: savings >= 1000 ? "green" : savings >= 300 ? "amber" : "red",
    },
  ];

  const improvementAreas = indicators
    .filter((i) => i.statusColor !== "green")
    .map((i) => ({ ...i, ...IMPROVEMENT_COPY[i.key] }));

  const financeRating =
    financeChange < -1000
      ? { label: "Krytyczne — poważne problemy finansowe", statusColor: "red" }
      : financeChange < 0
      ? { label: "Wymaga uwagi — ujemny bilans", statusColor: "amber" }
      : financeChange < 800
      ? { label: "Dobre — stabilna sytuacja", statusColor: "blue" }
      : { label: "Świetne — bardzo dobra kondycja finansowa", statusColor: "green" };

  const hasInvestment = rand() < 0.75;
  let investment = null;
  if (hasInvestment) {
    const instruments = [
      { name: "Kryptowaluty", min: -60, max: 140 },
      { name: "Akcje GPW", min: -25, max: 45 },
      { name: "Obligacje Skarbowe", min: 2, max: 9 },
    ];
    const instrument = instruments[Math.floor(rand() * instruments.length)];
    const initial = [500, 1000, 2000, 5000][Math.floor(rand() * 4)];
    const returnPct = Math.round((instrument.min + rand() * (instrument.max - instrument.min)) * 10) / 10;
    const final = Math.max(0, Math.round(initial * (1 + returnPct / 100)));
    investment = {
      name: instrument.name,
      initial,
      returnPct,
      final,
      day: 3 + Math.floor(rand() * 10),
      gain: final - initial,
    };
  }

  const keyLessons = [
    { icon: RefreshCw, title: "Holistyczne podejście do finansów i życia", desc: "Twoje zdrowie psychiczne, fizyczne i rozwój osobisty bezpośrednio wpływają na Twoje decyzje finansowe. Stres finansowy obniża psychikę, a niska psychika prowadzi do złych decyzji. Aby osiągnąć sukces, musisz balansować wszystkie aspekty życia." },
    { icon: Target, title: "Długofalowe planowanie finansowe", desc: "Każda decyzja ma konsekwencje przyczynowo-skutkowe. Wydatek na rozrywkę może obniżyć oszczędności, ale poprawić zdrowie psychiczne. Ucz się myśleć strategicznie: czy ta decyzja pomoże mi za tydzień, miesiąc albo rok?" },
    { icon: Scale, title: "Równowaga między oszczędzaniem a życiem", desc: "Oszczędzanie to klucz do bezpieczeństwa finansowego, ale nadmierne oszczędzanie kosztem zdrowia i relacji może być szkodliwe. Buduj poduszkę finansową, ale pamiętaj też o inwestowaniu w siebie i bliskich." },
    { icon: ShieldCheck, title: "Zarządzanie ryzykiem inwestycyjnym", desc: "Inwestycje wysokiego ryzyka oferują wysokie potencjalne zyski, ale też ogromne ryzyko straty. Nigdy nie inwestuj więcej niż możesz stracić." },
    { icon: BarChart3, title: "Planowanie budżetu metodą 50/30/20", desc: "Zasada 50/30/20: 50% na potrzeby, 30% na przyjemności, 20% na oszczędności i inwestycje. To prosty sposób na utrzymanie równowagi finansowej bez rezygnacji z życia." },
    { icon: LifeBuoy, title: "Znaczenie poduszki finansowej", desc: `Twoje końcowe oszczędności: ${savings} zł. Brak poduszki finansowej to poważne ryzyko. Zawsze staraj się odłożyć 10–20% dochodu na czarną godzinę.` },
  ];

  return {
    overallScore,
    tier,
    tierMeta: TIER_META,
    stats: [
      { key: "finanse", label: "Finanse", icon: Wallet, value: financeChange, unit: " zł", cardBg: "bg-green-50", cardBorder: "border-green-100" },
      { key: "psychika", label: "Psychika", icon: Brain, value: psychikaChange, unit: "%", cardBg: "bg-blue-50", cardBorder: "border-blue-100" },
      { key: "fizyka", label: "Fizyka", icon: HeartPulse, value: fizykaChange, unit: "%", cardBg: "bg-purple-50", cardBorder: "border-purple-100" },
      { key: "rozwoj", label: "Rozwój", icon: Rocket, value: rozwojChange, unit: "%", cardBg: "bg-orange-50", cardBorder: "border-orange-100" },
    ],
    investment,
    indicators,
    improvementAreas,
    financeSummary: { financeChange, savings, rating: financeRating },
    keyLessons,
  };
}

const STATUS_STYLES = {
  red: { bg: "bg-red-50", text: "text-red-600", bar: "bg-red-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
  green: { bg: "bg-green-50", text: "text-green-600", bar: "bg-green-500" },
  blue: { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500" },
};

/* ------------------------------------------------------------------ */
/* HELPERS — dane i style                                               */
/* ------------------------------------------------------------------ */

function formatMoney(n) {
  return `${n > 0 ? "+" : ""}${n} zł`;
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function studentDecisions(student) {
  return student.choices.map((optIdx, i) => ({
    ...DECISION_POINTS[i],
    pointIndex: i,
    optionIndex: optIdx,
    chosen: DECISION_POINTS[i].options[optIdx],
  }));
}

function pointStats(students, pointIndex) {
  const point = DECISION_POINTS[pointIndex];
  const counts = point.options.map(() => 0);
  let total = 0;
  students.forEach((s) => {
    if (s.choices[pointIndex] !== undefined) {
      counts[s.choices[pointIndex]] += 1;
      total += 1;
    }
  });
  return { point, counts, total };
}

function statusBadge(status) {
  if (status === "bankrut") {
    return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">Bankrut</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600">W grze</span>;
}

function stressColor(stress) {
  if (stress >= 70) return { bar: "bg-red-500", text: "text-red-600" };
  if (stress >= 40) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-green-500", text: "text-green-600" };
}

const BAR_COLORS = ["bg-indigo-500", "bg-purple-500", "bg-teal-500"];

/* ------------------------------------------------------------------ */
/* KOD QR (mock)                                                        */
/* ------------------------------------------------------------------ */

function QRCode({ value, size = 200 }) {
  const modules = 21;
  const matrix = React.useMemo(() => buildQrMatrix(value, modules), [value]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${modules} ${modules}`} className="block">
      <rect width={modules} height={modules} fill="white" />
      {matrix.map((row, r) =>
        row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#1e1b4b" /> : null))
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* POKÓJ NAUCZYCIELA (poczekalnia przed rozpoczęciem gry)               */
/* ------------------------------------------------------------------ */

function WaitingRoom({ onStart }) {
  const [roomCode, setRoomCode] = useState(() => randomRoomCode());
  const [secondsLeft, setSecondsLeft] = useState(ROTATE_SECONDS);
  const [justRotated, setJustRotated] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [copied, setCopied] = useState(false);

  // Rotacja kodu / QR co 3 minuty
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRoomCode(randomRoomCode());
          setJustRotated(true);
          setTimeout(() => setJustRotated(false), 900);
          return ROTATE_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Symulacja: uczniowie dołączają samodzielnie po zeskanowaniu kodu QR /
  // wpisaniu kodu pokoju. Nauczyciel ma jedynie podgląd tej listy — nie
  // dodaje ani nie usuwa uczestników ręcznie.
  useEffect(() => {
    const timeouts = [];
    let cumulative = 900;
    INITIAL_PARTICIPANTS.forEach((p) => {
      cumulative += 900 + Math.random() * 1700;
      const t = setTimeout(() => {
        setParticipants((prev) => [...prev, p]);
      }, cumulative);
      timeouts.push(t);
    });
    return () => timeouts.forEach(clearTimeout);
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard niedostępny w tym środowisku */
    }
  };

  const allJoined = participants.length >= INITIAL_PARTICIPANTS.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <span className="cursor-default select-none text-sm font-semibold text-slate-400">← Powrót</span>
        <h1 className="text-2xl font-bold text-slate-800">Pokój Nauczyciela</h1>
        <span className="w-16" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-500">Kod Pokoju</p>
          <button
            onClick={copyCode}
            className="mx-auto mb-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-mono text-2xl font-bold tracking-widest text-white shadow-md"
          >
            {roomCode}
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>

          <div className={`mx-auto mb-4 w-fit rounded-2xl border-2 p-4 transition-colors duration-300 ${justRotated ? "border-indigo-400" : "border-slate-100"}`}>
            <QRCode value={roomCode} size={220} />
          </div>

          <div className="mb-1 flex items-center justify-center gap-1.5 font-mono text-xs text-slate-500">
            <RefreshCw className={`h-3.5 w-3.5 ${justRotated ? "animate-spin" : ""}`} />
            Kod odświeży się za {formatClock(secondsLeft)}
          </div>
          <p className="mb-4 text-xs text-slate-400">Ze względów bezpieczeństwa kod QR zmienia się co 3 minuty.</p>

          <p className="text-sm text-slate-500">Uczniowie mogą zeskanować kod QR lub wpisać kod pokoju, aby dołączyć</p>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <style>{`
            @keyframes joinFade { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
            .join-fade { animation: joinFade 0.45s ease-out; }
          `}</style>

          <div className="mb-1 flex items-center justify-between">
            <p className="flex items-center gap-2 font-bold text-slate-800">
              <Users className="h-5 w-5 text-indigo-600" /> Uczestnicy ({participants.length})
            </p>
            {allJoined ? (
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600">
                <CheckCircle2 className="h-3 w-3" /> Wszyscy dołączyli
              </span>
            ) : (
              <span className="flex animate-pulse items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
                <Radio className="h-3 w-3" /> Dołączanie na żywo
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-slate-400">
            Podgląd na żywo — uczniowie dołączają samodzielnie, skanując kod QR lub wpisując kod pokoju.
          </p>

          <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: "360px" }}>
            {participants.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm text-slate-400">Oczekiwanie na uczestników...</p>
              </div>
            )}
            {participants.map((p) => (
              <div key={p.id} className="join-fade flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-bold text-white">
                    {p.name[0] ? p.name[0].toUpperCase() : "?"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">Urządzenie #{p.device}</p>
                  </div>
                </div>
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </div>
            ))}
          </div>

          <button
            onClick={() => participants.length > 0 && onStart(participants, roomCode)}
            disabled={participants.length === 0}
            className={`mt-5 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
              participants.length > 0 ? "bg-green-600 text-white hover:bg-green-700" : "cursor-not-allowed bg-slate-200 text-slate-400"
            }`}
          >
            <Play className="h-4 w-4" /> Rozpocznij Grę ({participants.length} uczestników)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SUBCOMPONENTS                                                        */
/* ------------------------------------------------------------------ */

function DecisionLedger({ student }) {
  const decisions = studentDecisions(student);
  if (decisions.length === 0) {
    return <p className="text-sm text-slate-400">Uczeń nie podjął jeszcze żadnej decyzji.</p>;
  }
  return (
    <ol className="relative border-l-2 border-slate-100 pl-6">
      {decisions.map((d) => (
        <li key={d.pointIndex} className="mb-7 last:mb-0">
          <span className="absolute mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-indigo-500" style={{ left: "-9px" }} />
          <div className="mb-1 flex items-center gap-2 font-mono text-xs text-slate-400">
            <Clock className="h-3 w-3" /> DZIEŃ {d.day}
          </div>
          <p className="text-sm font-semibold text-slate-800">{d.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{d.scenario}</p>
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-sm text-slate-700">
              Wybór: <span className="font-semibold">{d.chosen.label}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{d.chosen.result}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${d.chosen.budgetChange >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                {formatMoney(d.chosen.budgetChange)}
              </span>
              <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${d.chosen.stressChange > 0 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
                {d.chosen.stressChange > 0 ? "+" : ""}{d.chosen.stressChange}% stresu
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StudentDrawer({ student, onClose, mode }) {
  if (!student) return null;
  const sc = stressColor(student.stress);
  const decisions = studentDecisions(student);
  const flagged = decisions.filter(
    (d) => Math.abs(d.chosen.budgetChange) >= 300 || d.chosen.stressChange >= 20
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
              {student.name[0]}
            </div>
            <div>
              <p className="text-lg font-bold text-white">{student.name}</p>
              <p className="text-xs text-indigo-100">{student.device}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs text-slate-400">Dzień gry</p>
            <p className="font-mono text-lg font-bold text-slate-800">{student.day}/{TOTAL_DAYS}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Budżet</p>
            <p className={`font-mono text-lg font-bold ${student.budget >= 0 ? "text-green-600" : "text-red-600"}`}>{student.budget} zł</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Status</p>
            <div className="mt-0.5">{statusBadge(student.status)}</div>
          </div>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-500">Stres (zdrowie psych.)</span>
            <span className={`font-mono font-semibold ${sc.text}`}>{student.stress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${sc.bar}`} style={{ width: `${student.stress}%` }} />
          </div>
        </div>

        {mode === "report" && flagged.length > 0 && (
          <div className="border-b border-slate-100 bg-amber-50/50 px-6 py-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Flag className="h-4 w-4" /> Kluczowe momenty do omówienia
            </p>
            <ul className="space-y-2">
              {flagged.map((d) => (
                <li key={d.pointIndex} className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                  <span className="font-semibold text-slate-800">Dzień {d.day} — {d.title}: </span>
                  {TALKING_POINTS[`${d.pointIndex}-${d.optionIndex}`] || "Poproś ucznia, aby uzasadnił tę decyzję i porównał ją z alternatywami."}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="px-6 py-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4" /> Decyzje i rezultaty
          </p>
          <DecisionLedger student={student} />
        </div>
      </div>
    </div>
  );
}

function GameLinkTip({ link }) {
  if (link.context === "decision") {
    const point = DECISION_POINTS[link.pointIndex];
    const option = point.options[link.optionIndex];
    return (
      <div className="rounded-lg bg-indigo-50/70 px-3 py-2">
        <p className="mb-0.5 flex flex-wrap items-center gap-1 text-xs font-semibold text-indigo-700">
          <Clock className="h-3 w-3 flex-shrink-0" /> Dzień {point.day} — {point.title} → „{option.label}”
        </p>
        <p className="text-xs text-slate-500">{link.tip}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-indigo-50/70 px-3 py-2">
      <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
        <Target className="h-3 w-3 flex-shrink-0" /> {link.label}
      </p>
      <p className="text-xs text-slate-500">{link.tip}</p>
    </div>
  );
}

function LibraryDrawer({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const categoryMeta = (id) => LIBRARY_CATEGORIES.find((c) => c.id === id);

  const filtered = LIBRARY_ARTICLES.filter((a) => {
    const matchCat = category === "all" || a.category === category;
    const q = query.trim().toLowerCase();
    const matchQuery = !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <p className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <BookOpen className="h-5 w-5 text-indigo-600" /> Biblioteka Wiedzy
          </p>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Nawigacja kategorii */}
          <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-slate-100 p-3 md:w-56 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
            <button
              onClick={() => setCategory("all")}
              className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                category === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <LayoutGrid className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">Wszystkie</span>
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${category === "all" ? "bg-white/20" : "bg-slate-100"}`}>{LIBRARY_ARTICLES.length}</span>
            </button>
            {LIBRARY_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const count = LIBRARY_ARTICLES.filter((a) => a.category === c.id).length;
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    active ? `${c.bg} ${c.text}` : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{c.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-white/60" : "bg-slate-100"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Wyniki */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj artykułu..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {filtered.length === 0 && <p className="text-sm text-slate-400">Brak wyników dla podanych filtrów.</p>}
              <ul className="space-y-3">
                {filtered.map((a) => {
                  const isOpen = expandedId === a.id;
                  const meta = categoryMeta(a.category);
                  const Icon = meta.icon;
                  return (
                    <li key={a.id} className="rounded-xl border border-slate-100">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : a.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                          <Icon className={`h-4 w-4 ${meta.text}`} />
                        </div>
                        <div className="flex-1">
                          <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${meta.bg} ${meta.text}`}>
                            {meta.name}
                          </span>
                          <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                          <p className="text-xs text-slate-400">{a.readTime} czytania</p>
                        </div>
                        <ChevronRight className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-slate-100 px-4 py-3 pl-16">
                          <p className="text-xs leading-relaxed text-slate-500">{a.summary}</p>
                          {a.gameLinks && a.gameLinks.length > 0 && (
                            <div className="mt-3">
                              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                <Target className="h-3.5 w-3.5 text-indigo-500" /> Gdzie wykorzystać w grze
                              </p>
                              <div className="space-y-2">
                                {a.gameLinks.map((link, i) => (
                                  <GameLinkTip key={i} link={link} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LIVE DASHBOARD VIEW                                                  */
/* ------------------------------------------------------------------ */

function LiveDashboard({ students, roomCode, onSelectStudent, onEndLesson, isRunning, setIsRunning, speed, setSpeed, elapsed }) {
  const [copied, setCopied] = useState(false);
  const ranked = [...students].sort((a, b) => b.budget - a.budget);
  const active = students.filter((s) => s.status === "w_grze").length;
  const bankrupt = students.filter((s) => s.status === "bankrut").length;
  const avgBudget = students.length ? Math.round(students.reduce((a, s) => a + s.budget, 0) / students.length) : 0;
  const avgStress = students.length ? Math.round(students.reduce((a, s) => a + s.stress, 0) / students.length) : 0;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard niedostępny w tym środowisku */
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      {!isRunning && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          <Pause className="h-4 w-4" /> Gra wstrzymana — uczniowie oczekują na wznowienie.
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">Panel Nauczyciela: Wyniki na żywo</h1>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${isRunning ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
              <Radio className="h-3 w-3" /> {isRunning ? "Na żywo" : "Wstrzymane"}
            </span>
          </div>
          <button onClick={copyCode} className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
            Kod pokoju: <span className="font-mono font-semibold text-slate-600">{roomCode}</span>
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 pr-3">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="font-mono text-lg font-bold text-slate-700">{formatClock(elapsed)}</span>
          </div>
          <button
            onClick={() => setIsRunning((r) => !r)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? "Wstrzymaj" : "Wznów"}
          </button>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                  speed === s ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
          <button
            onClick={onEndLesson}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            <Square className="h-3.5 w-3.5" /> Zakończ Lekcję
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5 text-indigo-600" />} label="Aktywni Uczniowie" value={active} bg="bg-indigo-50" />
        <StatCard icon={<Wallet className="h-5 w-5 text-green-600" />} label="Średni Budżet" value={`${avgBudget} zł`} bg="bg-green-50" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-600" />} label="Bankructwa" value={bankrupt} bg="bg-red-50" />
        <StatCard icon={<Activity className="h-5 w-5 text-amber-600" />} label="Śr. Poziom Stresu" value={`${avgStress}%`} bg="bg-amber-50" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="flex items-center gap-2 font-bold text-slate-800">
            <Trophy className="h-5 w-5 text-amber-500" /> Ranking Klasy
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3 font-semibold">Miejsce</th>
                <th className="px-6 py-3 font-semibold">Uczeń</th>
                <th className="px-6 py-3 font-semibold">Dzień gry</th>
                <th className="px-6 py-3 font-semibold">Budżet</th>
                <th className="px-6 py-3 font-semibold">Stres</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => {
                const sc = stressColor(s.stress);
                const medal = ["🥇", "🥈", "🥉"][i];
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelectStudent(s)}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-500">{medal || i + 1}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{s.name}</td>
                    <td className="px-6 py-4 font-mono text-slate-500">{s.day}/{TOTAL_DAYS}</td>
                    <td className={`px-6 py-4 font-mono font-semibold ${s.budget >= 0 ? "text-green-600" : "text-red-600"}`}>{s.budget} zł</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${sc.bar}`} style={{ width: `${s.stress}%` }} />
                        </div>
                        <span className={`font-mono text-xs ${sc.text}`}>{s.stress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{statusBadge(s.status)}</td>
                    <td className="px-6 py-4 text-slate-300"><ChevronRight className="h-4 w-4" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-mono text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* END-OF-LESSON REPORTS                                                */
/* ------------------------------------------------------------------ */

function OverallReport({ students }) {
  const bankrupt = students.filter((s) => s.status === "bankrut").length;
  const avgBudget = students.length ? Math.round(students.reduce((a, s) => a + s.budget, 0) / students.length) : 0;
  const avgStress = students.length ? Math.round(students.reduce((a, s) => a + s.stress, 0) / students.length) : 0;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5 text-indigo-600" />} label="Uczniów w grze" value={`${students.length}`} bg="bg-indigo-50" />
        <StatCard icon={<Wallet className="h-5 w-5 text-green-600" />} label="Śr. wynik klasy" value={`${avgBudget} zł`} bg="bg-green-50" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-600" />} label="Bankructwa" value={`${bankrupt} / ${students.length}`} bg="bg-red-50" />
        <StatCard icon={<Activity className="h-5 w-5 text-amber-600" />} label="Śr. Poziom Stresu" value={`${avgStress}%`} bg="bg-amber-50" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="mb-1 flex items-center gap-2 font-bold text-slate-800">
          <BarChart3 className="h-5 w-5 text-indigo-600" /> Najpopularniejsze decyzje klasy
        </p>
        <p className="mb-5 text-xs text-slate-400">Rozkład wyborów uczniów w poszczególnych momentach rozgrywki.</p>

        <div className="space-y-6">
          {DECISION_POINTS.map((point, idx) => {
            const { counts, total } = pointStats(students, idx);
            const maxCount = Math.max(...counts);
            return (
              <div key={idx} className="border-b border-slate-50 pb-5 last:border-0 last:pb-0">
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Dzień {point.day} — {point.title}
                  <span className="ml-2 font-mono text-xs font-normal text-slate-400">({total} odpowiedzi)</span>
                </p>
                <div className="space-y-2">
                  {point.options.map((opt, oi) => {
                    const pct = total ? Math.round((counts[oi] / total) * 100) : 0;
                    const isWinner = counts[oi] === maxCount && maxCount > 0;
                    return (
                      <div key={oi} className="flex items-center gap-3">
                        <span className="w-40 flex-shrink-0 truncate text-xs text-slate-500 md:w-56">{opt.label}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${BAR_COLORS[oi % BAR_COLORS.length]}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-16 flex-shrink-0 text-right font-mono text-xs font-semibold text-slate-600">{pct}%</span>
                        {isWinner && <Trophy className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudentReportList({ students, onOpenStudent }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {students.map((s) => {
        const sc = stressColor(s.stress);
        return (
          <div key={s.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-bold text-white">
                {s.name[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-400">{s.device}</p>
              </div>
            </div>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className={`font-mono font-semibold ${s.budget >= 0 ? "text-green-600" : "text-red-600"}`}>{s.budget} zł</span>
              {statusBadge(s.status)}
            </div>
            <div className="mb-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${sc.bar}`} style={{ width: `${s.stress}%` }} />
              </div>
              <p className={`mt-1 font-mono text-xs ${sc.text}`}>Stres: {s.stress}%</p>
            </div>
            <button
              onClick={() => onOpenStudent(s)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              <FileText className="h-3.5 w-3.5" /> Zobacz raport
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ReportsHub({ students, roomCode, onBackToLive }) {
  const [tab, setTab] = useState("overall");
  const [reportStudent, setReportStudent] = useState(null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <div className="mb-6 rounded-2xl border border-green-100 bg-green-50 px-5 py-4">
        <p className="flex items-center gap-2 font-bold text-green-700">
          <CheckCircle2 className="h-5 w-5" /> Lekcja zakończona — raporty zostały wygenerowane
        </p>
        <p className="mt-0.5 text-xs text-green-600">Kod pokoju: {roomCode} · {students.length} uczestników</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => { setTab("overall"); setReportStudent(null); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "overall" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
          >
            Raport Ogólny
          </button>
          <button
            onClick={() => { setTab("students"); setReportStudent(null); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "students" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
          >
            Raporty Uczniów
          </button>
        </div>
        <button onClick={onBackToLive} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Powrót do panelu na żywo
        </button>
      </div>

      {tab === "overall" && <OverallReport students={students} />}

      {tab === "students" && !reportStudent && <StudentReportList students={students} onOpenStudent={setReportStudent} />}

      {tab === "students" && reportStudent && (
        <div>
          <button onClick={() => setReportStudent(null)} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Wszyscy uczniowie
          </button>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <StudentDrawerInline student={reportStudent} />
          </div>
        </div>
      )}
    </div>
  );
}

/* Wariant treści karty ucznia osadzony na stałe w stronie (bez nakładki),
   używany w widoku raportu indywidualnego. */
function StudentDrawerInline({ student }) {
  const report = buildStudentReport(student);
  const { tierMeta } = report;
  const TierIcon = tierMeta.icon;
  const decisions = studentDecisions(student);
  const flagged = decisions.filter(
    (d) => Math.abs(d.chosen.budgetChange) >= 300 || d.chosen.stressChange >= 20
  );

  return (
    <div>
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
            {student.name[0]}
          </div>
          <div>
            <p className="text-lg font-bold text-white">Raport ucznia: {student.name}</p>
            <p className="text-xs text-indigo-100">{student.device} · {student.day}/{TOTAL_DAYS} dni zakończonych</p>
          </div>
        </div>
        <GraduationCap className="h-6 w-6 text-white/80" />
      </div>

      <div className="space-y-6 px-6 py-6">
        {/* Nagłówek raportu */}
        <div>
          <span className="mb-2 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
            Raport z rozgrywki
          </span>
          <p className="text-xl font-bold text-slate-800">{tierMeta.title}</p>
        </div>

        {/* Karta wyniku ogólnego + 4 kafelki statystyk */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={`flex flex-col items-center justify-center rounded-2xl border-2 bg-gradient-to-br from-indigo-600 to-purple-600 px-6 py-8 text-center shadow-md md:col-span-1 ${tierMeta.glow}`}>
            <TierIcon className="mb-3 h-8 w-8 text-white" />
            <p className="text-3xl font-bold text-white">{report.overallScore}/100</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-100">Wynik ogólny</p>
            <p className="mt-3 text-xs italic text-indigo-100">{tierMeta.desc}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            {report.stats.map((s) => {
              const Icon = s.icon;
              const positive = s.value >= 0;
              return (
                <div key={s.key} className={`flex flex-col items-center justify-center rounded-2xl border px-4 py-5 text-center ${s.cardBg} ${s.cardBorder}`}>
                  <Icon className="mb-2 h-5 w-5 text-slate-500" />
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className={`font-mono text-lg font-bold ${positive ? "text-green-600" : "text-red-600"}`}>
                    {positive ? "+" : ""}{s.value}{s.unit}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wynik inwestycji */}
        {report.investment && (
          <div className="rounded-2xl border border-green-100 bg-green-50/60 p-5">
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
              {report.investment.gain >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Wynik inwestycji: {report.investment.name}
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Zainwestował/a {report.investment.initial} zł w dzień {report.investment.day}. Oto co się stało:
            </p>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white px-3 py-3 text-center">
                <p className="text-xs text-slate-400">Kwota początkowa</p>
                <p className="font-mono text-sm font-bold text-slate-800">{report.investment.initial} zł</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-3 text-center">
                <p className="text-xs text-slate-400">Zwrot</p>
                <p className={`font-mono text-sm font-bold ${report.investment.returnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {report.investment.returnPct >= 0 ? "+" : ""}{report.investment.returnPct}%
                </p>
              </div>
              <div className="rounded-xl bg-white px-3 py-3 text-center">
                <p className="text-xs text-slate-400">Kwota końcowa</p>
                <p className="font-mono text-sm font-bold text-slate-800">{report.investment.final} zł</p>
              </div>
            </div>
            <p className={`rounded-lg px-3 py-2 text-xs font-medium ${report.investment.gain >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {report.investment.gain >= 0
                ? `Inwestycja przyniosła zysk ${report.investment.gain} zł — dobry wybór!`
                : `Inwestycja przyniosła stratę ${Math.abs(report.investment.gain)} zł — dobry temat do rozmowy o ryzyku.`}
            </p>
          </div>
        )}

        {/* Szczegółowa analiza wskaźników */}
        <div className="rounded-2xl border border-slate-100 p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BarChart3 className="h-4 w-4 text-indigo-600" /> Szczegółowa Analiza Wskaźników
          </p>
          <div className="space-y-4">
            {report.indicators.map((ind) => {
              const Icon = ind.icon;
              const st = STATUS_STYLES[ind.statusColor];
              return (
                <div key={ind.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Icon className="h-3.5 w-3.5 text-slate-400" /> {ind.label}
                    </span>
                    <span className={`font-mono font-semibold ${st.text}`}>{ind.display} — {ind.statusLabel}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${ind.barPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Obszary wymagające poprawy */}
        {report.improvementAreas.length > 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Flag className="h-4 w-4" /> Obszary Wymagające Poprawy
            </p>
            <div className="space-y-2">
              {report.improvementAreas.map((a) => {
                const Icon = a.icon;
                return (
                  <div key={a.key} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                    <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Icon className="h-4 w-4 text-slate-400" /> {a.title}
                    </p>
                    <p className="text-xs text-red-500">✗ {a.issue}</p>
                    <p className="mt-1 text-xs text-slate-500">💡 <span className="font-semibold">Rekomendacja:</span> {a.recommendation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50/60 px-4 py-3 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Brak krytycznych obszarów — świetna równowaga między finansami, zdrowiem i rozwojem.
          </div>
        )}

        {/* Podsumowanie decyzji finansowych */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Wallet className="h-4 w-4 text-indigo-600" /> Podsumowanie Decyzji Finansowych
          </p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white px-4 py-3 text-center">
              <p className="text-xs text-slate-400">Zmiana budżetu</p>
              <p className={`font-mono text-lg font-bold ${report.financeSummary.financeChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                {report.financeSummary.financeChange >= 0 ? "+" : ""}{report.financeSummary.financeChange} zł
              </p>
            </div>
            <div className="rounded-xl bg-white px-4 py-3 text-center">
              <p className="text-xs text-slate-400">Oszczędności końcowe</p>
              <p className="font-mono text-lg font-bold text-indigo-600">{report.financeSummary.savings} zł</p>
            </div>
          </div>
          <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${STATUS_STYLES[report.financeSummary.rating.statusColor].bg} ${STATUS_STYLES[report.financeSummary.rating.statusColor].text}`}>
            Ocena zarządzania finansami: {report.financeSummary.rating.label}
          </p>
        </div>

        {/* Kluczowe wnioski i lekcje finansowe */}
        <div className="rounded-2xl border border-green-100 bg-green-50/40 p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-700">
            <LifeBuoy className="h-4 w-4" /> Kluczowe Wnioski i Lekcje Finansowe
          </p>
          <div className="space-y-2">
            {report.keyLessons.map((l, i) => {
              const Icon = l.icon;
              return (
                <div key={i} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Icon className="h-4 w-4 text-indigo-500" /> {l.title}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500">{l.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kluczowe momenty do omówienia (na podstawie decyzji) */}
        {flagged.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Flag className="h-4 w-4" /> Kluczowe momenty do omówienia z uczniem
            </p>
            <ul className="space-y-2">
              {flagged.map((d) => (
                <li key={d.pointIndex} className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                  <span className="font-semibold text-slate-800">Dzień {d.day} — {d.title}: </span>
                  {TALKING_POINTS[`${d.pointIndex}-${d.optionIndex}`] || "Poproś ucznia, aby uzasadnił tę decyzję i porównał ją z alternatywami."}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pełna ścieżka decyzji */}
        <div>
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4" /> Pełna ścieżka decyzji
          </p>
          <DecisionLedger student={student} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MODALS                                                               */
/* ------------------------------------------------------------------ */

function EndLessonModal({ count, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-6 w-6 text-red-600" />
        </div>
        <p className="mb-1 text-lg font-bold text-slate-800">Zakończyć lekcję?</p>
        <p className="mb-6 text-sm text-slate-500">
          Gra zostanie przerwana dla wszystkich uczniów, a dla każdego z {count} uczestników wygenerowany zostanie indywidualny raport wyników.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Anuluj
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
            Zakończ lekcję
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratingOverlay({ count }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      <div className="text-center">
        <p className="font-semibold text-slate-800">Generowanie raportów...</p>
        <p className="text-xs text-slate-400">Zbieranie decyzji i wyników {count} uczniów</p>
      </div>
    </div>
  );
}

function LibraryButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 transition hover:scale-105"
      aria-label="Otwórz bibliotekę wiedzy"
    >
      <BookOpen className="h-6 w-6" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* ROOT APP                                                             */
/* ------------------------------------------------------------------ */

export default function TeacherLiveLessonPanel() {
  const [stage, setStage] = useState("waiting"); // 'waiting' | 'live' | 'reports'
  const [students, setStudents] = useState([]);
  const [roomCode, setRoomCode] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!isRunning || stage !== "live") return;
    const id = setInterval(() => setElapsed((e) => e + speed), 1000);
    return () => clearInterval(id);
  }, [isRunning, speed, stage]);

  const handleStart = (participants, code) => {
    const built = participants.map((p) => ({
      id: p.id,
      name: p.name,
      device: `Urządzenie #${p.device}`,
      ...getProgress(p.name),
    }));
    setStudents(built);
    setRoomCode(code);
    setElapsed(0);
    setIsRunning(true);
    setStage("live");
  };

  const handleConfirmEnd = () => {
    setEndModalOpen(false);
    setIsRunning(false);
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setStage("reports");
    }, 1700);
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {stage === "waiting" && <WaitingRoom onStart={handleStart} />}

      {stage === "live" && (
        <LiveDashboard
          students={students}
          roomCode={roomCode}
          onSelectStudent={setSelectedStudent}
          onEndLesson={() => setEndModalOpen(true)}
          isRunning={isRunning}
          setIsRunning={setIsRunning}
          speed={speed}
          setSpeed={setSpeed}
          elapsed={elapsed}
        />
      )}

      {stage === "reports" && <ReportsHub students={students} roomCode={roomCode} onBackToLive={() => setStage("live")} />}

      {stage === "live" && <LibraryButton onClick={() => setLibraryOpen(true)} />}

      {selectedStudent && <StudentDrawer student={selectedStudent} onClose={() => setSelectedStudent(null)} mode="live" />}

      <LibraryDrawer open={libraryOpen} onClose={() => setLibraryOpen(false)} />

      {endModalOpen && <EndLessonModal count={students.length} onCancel={() => setEndModalOpen(false)} onConfirm={handleConfirmEnd} />}

      {generating && <GeneratingOverlay count={students.length} />}
    </div>
  );
}
