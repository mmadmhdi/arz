# TMRW / USD — Production Runbook

## First deploy

1. Deploy the repository to Netlify.
2. Set `ADMIN_TOKEN` to a long random secret.
3. Add optional enrichment keys.
4. Run the `refresh` Function manually once.
5. Call `/api/health`.
6. Call `/api/source-smoke` with the admin bearer token.
7. Inspect `/api/diagnostics`.
8. Run `backfill-usdt` manually if faster historical USDT coverage is desired.

## Normal state

A healthy service should have a recent refresh, a current TGJU physical-USD date, two USDT exchanges, non-conflicted source disagreement, working news sources, and a high-quality provisional forecast.

## If the public page shows no number

Check in this order:

1. `/api/health`
2. `/api/source-smoke`
3. `/api/diagnostics`
4. Netlify Function logs for `refresh`
5. Netlify Function logs for `lock-forecast`

Do not bypass the quality gate by inserting a manual number into the UI.

## If TGJU changes schema

`source-smoke` should expose a short/invalid history or missing current reference. Update the parser and parser tests before publishing. Do not relax OHLC or unit validation merely to make the source pass.

## If one USDT exchange is unavailable

The provisional model may continue with reduced confidence, but the official lock requires at least two exchange markets. Restore the source or add a well-documented independent replacement before changing the gate.

## If News Engine becomes noisy

Inspect shadow performance. If `noNews` consistently beats `fullRaw`, the live signal policy should shrink news automatically. Do not increase deterministic news weights without a measured evaluation plan.

## If live forecast error worsens

Review:

- last 30 vs previous 30 MAPE
- skill versus naive
- Live Forecast Guard state
- signal-policy ablation evidence
- regime mix
- source disagreement
- audit snapshot for the worst dates

A deterioration can be model drift, source drift, a regime change, or a broken parser. Treat those as separate hypotheses.

## Before every code upgrade

Run:

```bash
npm run check
npm test
```

When internet access is available, also run:

```bash
npm run audit:real
```

After deployment:

```bash
SITE_URL=https://your-site.example ADMIN_TOKEN=your-token npm run verify:production
```

## Storage rule

Do not rename the Netlify Blobs namespace `tmrw-usd-production` during ordinary version upgrades. The historical live record is part of the model.
