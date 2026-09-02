# TMRW / USD — Production v6

A production-oriented service that publishes one next-day forecast for Iran's free-market USD/Toman rate.

The public UI is intentionally minimal. The complexity stays on the server: live data collection, source validation, cross-market checks, news/event analysis, nested walk-forward backtesting, adaptive weighting, locking, scoring, calibration, shadow forecasts, audit snapshots, and production health checks.

## Target definition

The public number targets the **next Tehran calendar day's TGJU free-market USD reference close, converted from rial to toman**.

The official number is first attempted at **23:30 Tehran**. If that run fails, one safety retry runs at 23:50. Once a valid forecast is locked for a target date, it cannot be overwritten.

If no exact-date TGJU reference close is later available, the forecast is not scored against a different date.

## Data architecture

### Physical USD core

Primary history and current reference:

- TGJU `price_dollar_rl`
- TGJU long summary-table endpoint
- Accessban-compatible TGJU summary endpoint as availability fallback
- TGJU HTML/chart fallback
- A TGJU-derived public bootstrap mirror only as a last historical bootstrap fallback
- Bonbast public feed as an independent current-market cross-check when fresh

All TGJU rial values are converted to toman exactly once in the source layer.

The parser validates OHLC structure, date uniqueness, freshness, and implausible unit jumps. A source schema change should fail validation rather than silently enter the model.

### AED cross-check

TGJU free-market AED is converted with `3.6725 AED/USD` to an implied USD/Toman value. AED is **not** treated as another direct USD quote. It is a cross-market validation and limited adjustment signal.

If physical USD makes an unusually large move, the move must be confirmed by multiple direct observations and AED consistency before the official lock can accept it.

### USDT/Toman

Current signals:

- Wallex `USDTTMN`
- Wallex depth and recent trades when available
- Nobitex `USDTIRT`
- Recent Bonbast USDT
- Coinbase Exchange `USDT-USD` peg normalization

Nobitex IRT market prices are converted from rial to toman before consensus calculations.

The engine uses midpoint, source disagreement, spread, depth imbalance, recent trade flow, local USDT premium to physical USD, and global USDT peg deviation.

Historical USDT anchors are backfilled from Wallex and Nobitex hourly/UDF history near the same time-of-day as the official forecast. This allows the cross-market model to be tested with time-aligned historical inputs instead of treating today's USDT signal as an untested heuristic.

### Gold and macro

Small, capped inputs include:

- Iranian 18k gold versus global XAU/USD residual
- DXY proxy
- Brent
- EUR/USD
- Optional Alpha Vantage enrichment

These inputs cannot dominate the forecast.

## News and geopolitical engine

The news engine scores **event impact on USD/Toman**, not generic sentiment.

Sources include:

- GDELT
- Google News English
- Google News Persian
- OFAC Recent Actions
- U.S. Treasury press releases
- IAEA Iran material
- Central Bank of Iran official public Telegram channel
- Optional NewsAPI
- Optional OpenAI semantic event analysis at the nightly lock

Recognized event families include sanctions, sanctions relief, snapback, military escalation/de-escalation, ceasefire, nuclear negotiations, IAEA escalation/cooperation, CBI FX supply/intervention, FX stress, oil-export shocks, and major domestic instability.

Each event receives direction, importance, source-authority weight, time decay, duplicate suppression, domain saturation, and event-family saturation. Syndicated copies of one story do not count as independent events.

If `OPENAI_API_KEY` is present, a small deduplicated set of top events is sent to the OpenAI Responses API for a second semantic estimate of **24–48 hour USD/Toman impact**. The default model is `gpt-5.6-luna`, configurable with `OPENAI_NEWS_MODEL`. The semantic result is blended conservatively and cannot independently force an unrestricted move.

## Forecast engine

### Core model family

Nine core price models are always considered:

1. Naive/random-walk baseline
2. EWMA short-horizon drift
3. Damped Holt trend
4. Theil-Sen robust trend
5. Multi-horizon momentum
6. Regularized AR(3) return model
7. Mean-reversion model
8. Ridge regression over technical features
9. Historical analogue / KNN regime model

When enough time-aligned historical USDT data exist, a tenth **cross-market ridge challenger** is added.

### Technical features

The model family uses lagged returns, 3/5/10/20-day momentum, realized volatility, EMA spreads, RSI(14), 20-day z-score, recent drawdown, and shock/trend/range regime classification.

### Nested walk-forward weighting

Historical model evaluation is walk-forward. The ensemble weights used on an evaluated day are themselves learned only from earlier evaluation days. This avoids choosing weights using the same future outcomes used to grade them.

Weights are recency-aware, regime-aware, capped per model, and robustly blended. Forecast outliers are down-weighted before combination.

If the adaptive price ensemble does not demonstrate enough out-of-sample skill against `tomorrow = today`, its predicted movement is automatically shrunk toward the naive baseline. If performance becomes materially worse, the price-only movement can collapse to the baseline.

## External signals: live ablation policy

USDT, AED, gold-FX, news, macro, and intraday layers do not keep permanent trust simply because they sound useful.

Each official lock also stores shadow forecasts such as:

- Full uncalibrated model
- Pre-live-guard model
- Core-only model
- No-news
- No-USDT
- No-macro
- No-intraday
- No-AED
- No-gold-FX

The next day, all variants are scored against the same actual. After enough live observations, the system reduces the weight of layers whose removal consistently improves error. This is a live Champion–Challenger / ablation loop.

## Learning from real locked forecasts

Every official forecast is immutable and later scored against the exact target-date TGJU close.

Two separate live learning mechanisms are available only after enough data exist:

1. **Context residual calibration** — a regularized model can correct recurring residual patterns linked to USDT, news, macro, momentum, and other context. It activates only if a chronological holdout beats zero adjustment.
2. **Live Forecast Guard** — compares the forecasted move from the current rate with the move that actually occurred. If live history shows systematic overreaction, the published movement is shrunk. If a naive no-move baseline wins clearly on holdout, the guard may temporarily fall back toward it.

Neither mechanism can train on the target being predicted.

## Intraday layer

Verified snapshots are stored at the scheduled Free-plan refresh points. The engine derives recent physical-USD movement, USDT movement, premium changes, news-pressure changes, macro changes, and source coverage.

Only a rolling recent index is used for short-memory features, so multi-year operation does not require scanning the full snapshot archive on every forecast.

## Circuit breakers and quality gate

The service prefers no number to an unverified number.

An official lock requires, among other checks:

- At least 120 valid USD observations
- Fresh TGJU physical-USD reference for the current Tehran date
- Acceptable physical-market source disagreement
- AED consistency where available
- At least two independent USDT exchange markets
- Acceptable USDT disagreement
- Multiple working news-source families
- Sufficient nested walk-forward samples
- Acceptable ensemble skill versus naive
- Acceptable recent skill
- Controlled model dispersion
- `high` model quality
- Confirmation of unusually large live USD discontinuities

A trusted live USD shock up to the circuit-breaker limit is allowed into the model. A large unconfirmed shock is not silently treated as real, and an extreme trusted discontinuity beyond the hard limit stops forecasting for manual/source review.

## Immutable audit trail

Each locked forecast stores:

- Forecast ID and SHA-256 input fingerprint
- Source timestamps
- Physical USD observations and disagreement
- USDT observations, peg, spreads and flow/depth signals
- News score and top events
- Macro inputs
- Intraday features
- Signal policy
- Model weights and backtest state
- Meta calibration
- Live guard state

A separate private `audit-inputs/<forecastId>` snapshot stores bounded source histories and the detailed model inputs needed to reconstruct why that forecast was produced.

## Persistent storage

Netlify Blobs uses the stable namespace `tmrw-usd-production`. The store name is deliberately not tied to a code version, so future model upgrades keep the live performance history and calibration dataset.

Reads use strong consistency for forecast state and lock/audit operations.

## Scheduling

Netlify cron uses UTC. Tehran is UTC+03:30.

- Regular refresh: `00:32`, `04:32`, `08:32`, `12:32`, `16:32`, `20:32 UTC` = approximately `04:02`, `08:02`, `12:02`, `16:02`, `20:02`, `00:02 Tehran`
- Dedicated pre-lock refresh: `19:55 UTC` = `23:25 Tehran`
- Official lock attempts: `20:00`, `20:20 UTC` = `23:30`, `23:50 Tehran`
- Historical USDT backfill: hourly, then becomes a no-op when complete
- Evaluation/reconciliation: twice daily

The dedicated pre-lock refresh gives the nightly model a very recent verified market snapshot while keeping the heavy collection step separate from the lock.

## API endpoints

Public:

- `GET /api/forecast`
- `GET /api/health`
- `GET /api/history?limit=30`

Private with `Authorization: Bearer <ADMIN_TOKEN>`:

- `GET /api/diagnostics`
- `GET /api/source-smoke`

`source-smoke` performs a non-mutating production read of the major external sources and recent historical USDT route. Use it after deployment or after a suspected source schema change.

## Environment variables

```text
NEWSAPI_API_KEY=
ALPHA_VANTAGE_API_KEY=
OPENAI_API_KEY=
OPENAI_NEWS_MODEL=gpt-5.6-luna
ADMIN_TOKEN=
```

All enrichment keys are optional. Set a strong random `ADMIN_TOKEN` in production.

## Public UI

The browser shows only the target date, tomorrow's forecast in Toman, Tehran time, provisional/locked state, creator identity, and disclaimer.

Creator email:

`mmd85mmd@gmail.com`

The UI never fabricates a preview price. If verified backend data are unavailable, it shows no forecast number.

## Accuracy policy

No honest implementation can guarantee 99.99% next-day accuracy for Iran's free-market USD/Toman rate. The project instead minimizes **measured locked-forecast error** and keeps the evidence.

Do not advertise an accuracy number until a sufficiently large live record exists. The useful metrics are MAPE, median APE, P90 APE, directional accuracy, rolling performance, regime performance, and skill versus the naive baseline.

## Deploy

1. Create a GitHub repository from this folder.
2. Import the repository into Netlify.
3. Add environment variables if desired.
4. Publish the site.
5. In Netlify Functions, run `refresh` once manually.
6. Run `backfill-usdt` manually a few times if you want historical cross-market coverage to fill faster; otherwise the four-times-daily bootstrap schedule will complete it gradually.
7. Check `/api/health`.
8. With `ADMIN_TOKEN`, check `/api/source-smoke` and `/api/diagnostics`.
9. Allow the system to accumulate locked live forecasts before making any accuracy claim.

## Validation commands

```bash
npm install
npm run check
npm test
```

Optional internet-backed real-history core audit:

```bash
npm run audit:real
```

Post-deploy verification:

```bash
SITE_URL=https://your-site.example ADMIN_TOKEN=your-token npm run verify:production
```

See `MODEL_CARD.md` for methodology and `RUNBOOK.md` for production operations.

---

## Netlify Free production profile (v6.1)

This package is tuned specifically for the current **Netlify Free credit-based plan**.

### Why the schedule is intentionally sparse

The prediction engine is not triggered by page views. Data collection is scheduled, the forecast is stored, and the public endpoint only reads the stored result. The public forecast response also uses Netlify **durable CDN caching**, so repeated visitors can reuse the same edge-cached response instead of invoking the Function each time.

Regular collection runs six times per day at approximately **04:02, 08:02, 12:02, 16:02, 20:02, and 00:02 Tehran**. A separate verified refresh runs at **23:25 Tehran**, five minutes before the official lock. This preserves the most important high-freshness observation while avoiding 48 full collection jobs every day.

The official forecast is attempted at **23:30 Tehran** with one safety retry at **23:50**. Evaluation runs once per day at approximately **00:45 Tehran**. Historical USDT backfill runs four times per day only while the bootstrap window is incomplete; after completion it exits almost immediately.

### Important free-plan operating rule

Avoid unnecessary production deploys. On Netlify's credit-based plans, a successful production deploy itself consumes plan credits. Use Deploy Previews while testing changes and publish to production only when the version is ready.

### Free-mode freshness

The public provisional forecast tolerates the lower daytime collection cadence. This does **not** weaken the official nightly number: `lock-forecast` still applies the strict pre-lock freshness and source-quality requirements after the dedicated 23:25 refresh.

### Recommended environment variables

The core service can run without paid API services. Keep optional services unset if zero external cost is a hard requirement:

```text
ADMIN_TOKEN=<long-random-secret>
OPENAI_API_KEY=
NEWSAPI_API_KEY=
ALPHA_VANTAGE_API_KEY=
```

If an optional provider has a free quota, you may add it later, but the production design must not depend on it.
