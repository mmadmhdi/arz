# Netlify Free operating profile

This deployment profile is designed to keep the forecasting service inside a zero-cost Netlify setup while preserving the high-value observations used for the next-day USD/Toman forecast.

## Daily scheduled work

- 6 regular verified refreshes
- 1 dedicated pre-lock refresh at 23:25 Tehran
- 2 lock attempts, with the second acting as a safety retry
- 1 evaluation pass
- 4 temporary USDT-history backfill passes until history is complete; afterwards they are near-zero-cost no-ops

The public page never runs the prediction pipeline. It reads a stored forecast through a durable CDN-cached Function response.

## Cost-control priorities

1. Keep production deploys rare. Test with deploy previews.
2. Do not set paid AI/API keys unless you explicitly want external charges.
3. Keep the public forecast endpoint cacheable.
4. Do not restore high-frequency refreshes unless live performance proves they materially improve next-day accuracy.
5. Review Netlify credit usage periodically. If usage rises, reduce low-value refreshes before weakening the 23:25 pre-lock refresh.

## Accuracy priority

The free profile reduces redundant daytime collection, not the critical nightly observation. The official lock is still preceded by a fresh verified data pull and the same strict quality gate, source-consensus checks, backtest logic, shadow models, and immutable lock process.
