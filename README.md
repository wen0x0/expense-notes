# Expense Notes

## Features

- English UI
- VND currency formatting
- Amount input in thousands: `24` means `24,000 VND`, `24.5` means `24,500 VND`
- Retro sticky-note style with soft colors
- Mobile-first responsive layout
- Dashboard cards and simple charts
- Category create/delete
- Transaction create/edit/delete with confirm
- Recent transactions toggle and group by category
- Docker local testing for WSL2
- Auto local D1 migrate + seed before dev server starts

## Run locally

```bash
docker compose down -v
docker compose up --build
```

Open: http://localhost:8787

## Shared app password

This project uses one shared password for the whole app. The Cloudflare Worker checks the `X-App-Password` header before allowing `/api/categories`, `/api/transactions`, and `/api/summary`.

For local development, copy the example file and choose your password:

```bash
cp .dev.vars.example .dev.vars
```

For production, set the Worker secret:

```bash
npx wrangler secret put APP_PASSWORD
```

Then deploy again:

```bash
npm run deploy
```

The frontend will show a lock screen, store the password in `localStorage`, and send it with API requests.
