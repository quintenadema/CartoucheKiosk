# Cartouche Kiosk webapp

De webapp verzorgt de wedstrijd- en sponsorweergave voor de schermen van HC Cartouche. De productieomgeving draait binnen het Vercel-team **ADEMA Group** onder beheer van Quinten Adema. Sponsorcontent en beheerdersaccounts staan in Neon; sponsorlogo’s en uitgelichte sponsorfoto’s staan in Vercel Blob.

## Routes

| Route | Doel | Toegang |
| --- | --- | --- |
| `/indoor` | Wedstrijden in de Cartouche Hockey Dome | Publiek, kioskweergave |
| `/outdoor` | Veldindeling en buitenwedstrijden, met horizontale sponsorcarrousel en uitgelichte sponsormomenten | Publiek, kioskweergave |
| `/sponsors` | Doorlopende sponsorcarrousel | Publiek, kioskweergave |
| `/admin/login` | Login met het gezamenlijke clubwachtwoord | Publiek formulier |
| `/admin` | Sponsoren toevoegen, aanpassen, ordenen, verbergen en verwijderen | Alleen toegestane beheerders |

De wedstrijdgegevens worden server-side via `src/pages/api/games.js` opgehaald. Sponsoren worden door `src/pages/api/sponsors.js` uit Neon gelezen. De publieke pagina’s bevatten geen geheime database- of Blob-credentials.

## Techniek

- Next.js 16 Pages Router en React 19;
- Bun als package manager en JavaScript-runtime voor scripts;
- Tailwind CSS voor de schermen en beheerinterface;
- Better Auth met een wachtwoord-only scherm en één intern beheerdersaccount;
- Neon Postgres via een pooled `DATABASE_URL`;
- Vercel Blob in publieke leesmodus voor sponsorlogo’s en uitgelichte foto’s;
- Vercel voor builds, hosting, serverless API-routes en secrets.

## Lokale installatie

Vereisten: Bun, toegang tot het Vercel-team en de Vercel CLI.

```bash
bun install
bunx --bun vercel@latest link --project cartouche-kiosk --scope adema-group
bunx --bun vercel@latest env pull .env.local --environment=development
bun run dev
```

Gebruik `.env.example` alleen als referentie. `.env.local` is door Git genegeerd en mag niet worden gedeeld.

## Omgevingsvariabelen

| Variabele | Functie |
| --- | --- |
| `DATABASE_URL` | Pooled connection string naar Neon `cartouche-dome` |
| `BLOB_READ_WRITE_TOKEN` | Schrijftoken van Blob-store `cartouche-sponsors` |
| `BETTER_AUTH_SECRET` | Ondertekent en versleutelt Better Auth-data; minimaal 32 willekeurige bytes |
| `BETTER_AUTH_URL` | Canonieke URL, productie: `https://cartouche-kiosk.vercel.app` |
| `ADMIN_EMAILS` | Komma-gescheiden allowlist voor `/admin` |
| `ADMIN_LOGIN_EMAIL` | Interne Better Auth-gebruiker achter het gezamenlijke wachtwoord; niet zichtbaar op het loginformulier |
| `ALLOW_ADMIN_SIGNUP` | Alleen tijdelijk gebruikt door het lokale beheerdersscript; in productie uit laten |

Vercel bevat op dit moment de database-, Blob- en Better Auth-configuratie voor Production, Preview en Development. Na een wijziging moet opnieuw worden gedeployed; bestaande deployments krijgen nieuwe env-waarden niet automatisch.

## Database en migraties

De SQL-bestanden in `migrations/` zijn idempotent en bevatten:

- `001-better-auth.sql`: accounts, credentials, sessies en verificaties;
- `002-sponsors.sql`: sponsornaam, logo-URL, Blob-pad, website, volgorde en zichtbaarheid;
- `003-better-auth-rate-limit.sql`: persistente begrenzing van inlogpogingen;
- `004-featured-sponsors.sql`: uitgelichte status en de URL en het Blob-pad van de uitgelichte foto.

Nieuwe of lege Neon-database voorbereiden:

```bash
bunx --bun vercel@latest env pull .env.local --environment=development
bun run db:migrate
```

De bestaande sponsoren eenmalig vanuit de clubsite naar Neon en Vercel Blob migreren:

```bash
bun run sponsors:import
```

De import slaat namen over die al in Neon bestaan en is daardoor veilig opnieuw te starten na een gedeeltelijke netwerkfout. Normaal sponsorbeheer loopt daarna uitsluitend via `/admin`; de publieke API scrape't de clubsite niet meer.

Bij een Better Auth-upgrade moet het auth-schema opnieuw met de Better Auth CLI worden gecontroleerd voordat de packageversie wordt uitgerold. Test schemawijzigingen bij voorkeur eerst op een Neon-branch.

## Beheerdersaccount en gezamenlijk wachtwoord

1. Voeg het e-mailadres toe aan `ADMIN_EMAILS` in Vercel voor de gewenste omgevingen.
2. Haal de Development-variabelen lokaal op.
3. Start het script; het wachtwoord wordt verborgen ingevoerd en moet minimaal 12 tekens bevatten.

```bash
bunx --bun vercel@latest env pull .env.local --environment=development
bun run admin:create -- beheerder@example.com "Naam Beheerder"
```

Publieke registratie is uitgeschakeld. Productie gebruikt één intern Better Auth-account: het adres staat zowel in `ADMIN_EMAILS` als `ADMIN_LOGIN_EMAIL`, maar gebruikers zien op `/admin/login` uitsluitend het wachtwoordveld. Een bestaand Better Auth-account zonder vermelding in `ADMIN_EMAILS` krijgt geen beheerrechten.

Het gezamenlijke wachtwoord wijzigen en alle bestaande sessies intrekken:

```bash
bunx --bun vercel@latest env run -e production -- bun scripts/set-admin-password.mjs beheerder@example.com
```

Het wachtwoord wordt verborgen ingevoerd, uitsluitend als Better Auth-hash opgeslagen en nooit in Git of een Vercel-omgevingsvariabele gezet. Mislukte logins worden persistent in Neon begrensd.

## Sponsorbeheer

Een beheerder kan in `/admin`:

- een PNG-, JPG- of WebP-logo van maximaal 4 MB uploaden;
- sponsornaam en optionele website instellen;
- de sorteervolgorde bepalen;
- een sponsor tijdelijk verbergen zonder gegevens te verwijderen;
- een sponsor als `Uitgelicht` markeren en daarvoor een liggende foto uploaden;
- een sponsor definitief verwijderen.

Uploads gaan rechtstreeks van de browser naar Vercel Blob met een kortlevend uploadtoken. Dat token wordt alleen afgegeven na een geldige beheerderssessie. Bij vervangen of verwijderen ruimt de API het oude Blob-object op.

Op `/outdoor` pauzeert de horizontale carrousel wanneer een uitgelichte sponsor het midden van het scherm bereikt. De uitgelichte foto zoomt dan naar een bijna schermvullende takeover, blijft 10 seconden zichtbaar en zoomt daarna terug. De carrousel hervat vervolgens automatisch. Alleen actieve sponsors met zowel `featured = true` als een geldige uitgelichte foto kunnen deze takeover starten.

## Testen en bouwen

```bash
bun run lint
bun run build
```

Controleer vóór deployment minimaal:

- login en logout op `/admin`;
- sponsor toevoegen, aanpassen, verbergen en verwijderen;
- `Uitgelicht` aanzetten, een foto uploaden en de 10-seconden-takeover op `/outdoor` controleren;
- weergave op `/sponsors` zonder beheerderssessie;
- `/indoor` en `/outdoor` op de resoluties van de echte schermen.

## Deployment

De normale productieflow loopt via de gekoppelde GitHub-repository en het Vercel-project `adema-group/cartouche-kiosk`. Handmatig deployen kan vanuit deze map:

```bash
bunx --bun vercel@latest deploy
bunx --bun vercel@latest deploy --prod
```

Controleer na deployment de Build Logs en Runtime Logs in Vercel. Roll back via de deploymentgeschiedenis als een nieuwe versie de kioskschermen verstoort.

## Beveiligingskeuzes

- alle adminpagina’s doen een server-side sessiecheck;
- alle sponsor-mutatie- en uploadroutes controleren opnieuw de Better Auth-sessie en allowlist;
- registratie staat standaard uit;
- het gezamenlijke wachtwoord staat alleen als Better Auth-hash in Neon;
- de interne accountidentifier wordt uitsluitend server-side aan de Better Auth-login toegevoegd;
- maximaal vijf wachtwoordpogingen per minuut en IP-adres, persistent opgeslagen in Neon;
- cookies zijn in productie secure en HTTP-only via Better Auth;
- database- en Blob-credentials komen alleen uit omgevingsvariabelen;
- alleen openbare sponsorlogo’s staan in de publieke Blob-store;
- `/admin` krijgt `noindex,nofollow`.

## Belangrijke externe documentatie

- [Next.js Pages Router](https://nextjs.org/docs/pages)
- [Better Auth met Next.js](https://better-auth.com/docs/integrations/next)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [Vercel Blob client uploads](https://vercel.com/docs/vercel-blob/client-upload)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
