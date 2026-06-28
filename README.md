# Expense Notes

A tiny personal expense tracker for Cloudflare Workers + D1.

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
