# Fonts

Both faces are licensed under the SIL Open Font License 1.1.

- **Noto Naskh Arabic** (`noto-naskh-arabic-var.woff2`) — Google Fonts, Arabic subset, variable weight 400–700.
- **Nunito** (`nunito-var.woff2`) — Google Fonts, Latin subset, variable weight 200–1000.

These `.woff2` files are the sources. They are base64-inlined as `@font-face`
data URIs in `app/index.html` and `brand/index.html` so both pages render the
brand's real typography while making zero external requests. Regenerate the
inlined blocks from these files if the faces are ever updated.
