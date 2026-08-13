# 13 — Mobile forms

Requirements applied across merchant and customer forms:
- input height ≥ 44px (`ui/field` currently ~42px — one token change)
- `inputMode` / `type` correct per field: `numeric` for quantities and PINs, `tel` for phones, `email`, `decimal` for money
- labels always visible (never placeholder-as-label)
- complex selectors → bottom sheets
- native date/time pickers
- multi-step forms keep entered data after a failed submit (checkout already does this)
- `autoComplete` on address, phone, name

The product form was recently chunked into four named sections — that pattern (label + hairline) is the house standard for long forms.
