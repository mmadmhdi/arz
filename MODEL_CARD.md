# TMRW / USD — Model Card v6

## Purpose

Forecast one next-day reference value for Iran's free-market USD/Toman rate while keeping the public product deliberately simple.

## Forecast target

Next Tehran calendar day's TGJU `price_dollar_rl` reference close, converted from rial to toman.

## Design principle

A more complex model is accepted only when there is evidence that it improves out-of-sample or live locked-forecast error. Complexity is not treated as accuracy by itself.

## Core safeguards

- Nested walk-forward model selection
- Naive baseline always present
- Per-model weight caps
- Robust forecast blending
- Regime-aware weighting
- Time-aligned historical USDT challenger
- Source disagreement penalties
- Event/news adjustment caps
- Volatility-aware move guardrail
- Live ablation of external signal groups
- Chronological holdout before residual calibration activates
- Chronological holdout before live movement shrink activates
- Immutable pre-target lock and post-target scoring

## Leakage policy

No feature or calibration row may use information timestamped after the forecast lock for the date being predicted. Historical USDT is anchored to the last fully completed hourly candle available before the nightly lock.

## Source-risk policy

No single scraped source should silently become truth after a schema change. Numeric parsing is followed by domain checks, OHLC consistency checks, freshness checks, unit-jump checks, and cross-market validation where possible.

## External signal governance

The following groups are treated as overlays: USDT, AED, gold-FX, news, macro, intraday. Shadow forecasts measure the incremental value of each group on real locked outcomes. Harmful groups are automatically down-weighted after enough evidence.

## Live model governance

The live Forecast Guard does not optimize against the current target. It fits only on previous locked forecasts, uses a chronological holdout, and activates only when the holdout demonstrates lower error than the unguarded movement.

## Failure behavior

The product can return no number. Missing, stale, contradictory, or structurally invalid core data are valid reasons to reject an official lock.

## Accuracy statement

The model is not guaranteed to achieve any fixed percentage accuracy. Its valid accuracy is the measured performance of immutable forecasts that existed before their target dates.
