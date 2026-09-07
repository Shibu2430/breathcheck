# BreathCheck

A guided breathing self-assessment: resting rate, breath hold, and box breathing,
scored into an overall wellness snapshot with day-over-day tracking via localStorage.

No build step, no dependencies, no backend. Plain HTML/CSS/JS.

## Two parts to this site

- **The app** (`index.html`, `styles.css`, `script.js`) — plain, no build step, works exactly
  as before.
- **The blog** (`_config.yml`, `_layouts/`, `_includes/`, `_posts/`, `blog/index.html`) — a
  Jekyll site. GitHub Pages builds this automatically on every push; you never run a build
  command yourself for normal use.

## Run locally

**App only:** just open `index.html` in a browser, or serve the whole folder:
```
python3 -m http.server 8000
```

**Full site including the blog** (needs Ruby + Bundler installed once):
```
bundle install
bundle exec jekyll serve
```
then visit `http://localhost:4000`. This builds the blog *and* passes through the plain
app files untouched, so both work together exactly as they will on GitHub Pages.

## Deploy to GitHub Pages

1. Create a new repo (e.g. `breathcheck`) on GitHub.
2. Push the whole project folder (all files, including the Jekyll ones) to the repo root.
3. In the repo: **Settings → Pages → Source**, choose the `main` branch, root folder.
   GitHub detects the Jekyll config automatically and builds it — no extra setup needed.
4. Your site will be live at `https://<your-username>.github.io/breathcheck/`, and the
   blog at `https://<your-username>.github.io/breathcheck/blog/`.

```
git init
git add .
git commit -m "Initial BreathCheck site with blog"
git branch -M main
git remote add origin https://github.com/<your-username>/breathcheck.git
git push -u origin main
```

Then enable Pages in the repo settings as above. The first build after pushing takes
a minute or two — check the repo's **Actions** tab to watch progress.

## Writing a new blog post

Add a new file to `_posts/` named `YYYY-MM-DD-your-title.md`:

```markdown
---
title: "Your post title"
---

Write in plain Markdown here. Headings, lists, links, bold/italic all work normally.
```

Commit and push — GitHub rebuilds the site and the new post appears on `/blog/`
automatically, newest first. No HTML, no JS, nothing else to touch.

## What's implemented (Phase 1 + streak tracking)

- Hero, intro, and a 3-stage guided assessment (resting rate tap-counter,
  breath-hold stopwatch, animated box-breathing pacer)
- Results dashboard: overall wellness, breathing age, control score, resting rate
- Day-over-day comparison and a one-line recommendation
- localStorage-based history, streak counting (current + best), and a 14-day log
- Fully responsive: single column on mobile, wider grid layout on tablet/laptop

## Not yet implemented (future phases)

- Daily rotating challenge, badges
- Progress graph (currently a plain list — a chart would be a nice addition)
- Accounts / cross-device sync (would need a backend, e.g. Supabase)
- Guided audio sessions, premium programs

## Notes on the scores

The "breathing age" and 0–100 scores are illustrative, trend-tracking metrics —
not clinical measurements. Say so plainly in-app; don't imply diagnostic accuracy.
