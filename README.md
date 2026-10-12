# Bad Roses website

A static, GitHub Pages-ready website for the Bad Roses Star Stable community.

## Included
- Main page overview
- Searchable mini-wiki built from the uploaded HM 2018 Database spreadsheet
- Waitlist instructions
- Social links for the community Discord, club Discord, and TikTok
- Recreated Spirit schedule plus the original reference image
- Championship schedule placeholder
- Privacy and credits information

## Site links
The public site uses `site-config.js` for its Discord and TikTok links.

The website uses no server-side code, database service, login, forms, analytics, or site-created cookies. The searchable database is included in `database-data.js` so it works even when `index.html` is opened directly, and `database.json` remains available as the editable data source. Keep both files in the same folder when publishing. A local static server is still recommended for development (for example, `python -m http.server 8000`).

## Database and images
The spreadsheet records are converted into `database.json`. Item images use the image URLs provided in the workbook, so images require an internet connection and may depend on the original image hosts remaining available. The uploaded Spirit schedule image is stored locally at `assets/spirit-schedule-reference.png`.

## Legal / rights note
The site includes a privacy/credits page and an independent fan-project disclaimer. This is not legal advice.
