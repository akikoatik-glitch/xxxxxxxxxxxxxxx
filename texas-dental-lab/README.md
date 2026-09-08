# Texas Dental Lab — Premium Domain + Website Concept

Isolated project for **texasdentallab.com** — intentionally separate from any other workspace project.

## Deploy
This folder is the site root. Deploy `texas-dental-lab/` as the root of `texasdentallab.com` (Vercel / Netlify / static host).

- Canonical: `https://texasdentallab.com/`
- `vercel.json` included (cleanUrls + security headers + CSP allowing jsdelivr + Google Fonts).
- `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `favicon.svg`, OG image `assets/img/og-image.svg`.

## Preview locally
Serve THIS folder as root (so `/services/` etc. resolve):

```powershell
cd texas-dental-lab
python -m http.server 8080
# open http://localhost:8080/
```

Or with Node:
```powershell
npx serve .
```

## Structure
- `index.html` — homepage: 3D hero, workflow, services, tech, precision, Texas, about, contact, domain-sale
- `services/`, `services/crowns|zirconia|implants|veneers/`
- `digital-dentistry/`, `technology/`, `about/`, `contact/`, `404.html`
- `assets/css/main.css`, `assets/js/main.js`, `assets/js/hero-3d.js`

## 3D & performance
- Three.js 0.160 via jsDelivr importmap, procedural crown (no external models).
- Lazy init on visibility, pauses offscreen, mobile pixel-ratio + particle caps, `prefers-reduced-motion` + `Save-Data` + no-WebGL fallbacks.
- No build step — keep it fast.

## Forms & analytics
- Two forms (contact + domain) with required validation, honeypot, sanitization, local demo receipt + mailto fallback.
- Connect a backend (Formspree/Resend/HubSpot) post-acquisition.
- Analytics stub: `window.tdlTrack(event,data)` + `data-track` attributes → wire GA4/Plausible via `window.dataLayer` or `window.plausible`.

## Honesty rules (do not break)
No fake owners, staff, addresses, phones, testimonials, logos, awards, certifications, or business stats. Placeholders are labeled. Counters are UI illustrations.
