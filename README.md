# jewelcase 100

**before playlists, there were bedroom walls.**

rank the album covers that shaped your taste, generate a shareable poster, and get stats on your listening identity.

live at [jewelcase100.weirdlittleideas.com](https://jewelcase100.weirdlittleideas.com)

---

## what it does

- **search** — find albums via iTunes Search API with real cover art
- **rank** — drag to arrange up to 100 albums in your personal order
- **poster** — generate a high-res grid image (up to 3000px) with optional rank numbers
- **stats** — artist leaderboard, genre breakdown, and era chart (how your taste maps to your life)
- **share** — web share API for native mobile sharing; desktop saves a .png

## tech

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- dnd-kit for drag-and-drop (desktop grid + mobile vertical list)
- HTML Canvas for poster and stats card generation
- iTunes Search API for album metadata
- localStorage persistence

## local dev

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## deploy

Deployed on Vercel. Push to `main` → auto-deploy.
