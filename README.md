# Wiki Bloc (`pocket-climb`)

An open-source community climbing wiki providing area, crag, route, and boulder beta powered by **OpenBeta**, **PocketPages** (PocketBase), **Tailwind CSS**, and **DaisyUI**.

## Features

- **Server-Side Rendering**: Fast, SEO-friendly EJS pages with OpenGraph & JSON-LD metadata.
- **OpenBeta Directory & Sync**: Area/crag hierarchy, climb grades, pitches, and GraphQL batch sync (`/api/sync`).
- **Community Media & Ticks**: Authenticated photo uploads (Imgur integration) and climb tick logging.
- **Seamless Navigation**: Client-side router (`app-router.js`) with in-memory page caching and Speculation Rules prefetching.
- **Light & Dark Themes**: `nord` and `dark` DaisyUI themes persisted via cookie and `localStorage`.

## Prerequisites

- [Node.js](https://nodejs.org/) (v22+)
- [PocketBase](https://pocketbase.io/)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kimjust6/pocket-climb.git
   cd pocket-climb
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure secrets (e.g., `CRON_SECRET`, `IMGUR_CLIENT_ID`).

## Usage

### Development

Run PocketBase and the Tailwind CSS watcher concurrently:

```bash
npm run dev
```

### Checks & Tests

```bash
npm run check   # Syntax-check backend JS files
npm test        # Run unit tests (node --test)
```

### Deployment

```bash
npm run push
```

## Project Structure

- `pb_hooks/`: Server-side PocketBase hooks, API endpoints, and PocketPages routes.
  - `pages/(navbarLayout)/`: Main pages with shared navbar/footer layout.
  - `pages/_private/`: Reusable EJS partials and interactive islands.
  - `pages/utils/`: Server-side helpers (`common.js`, `pocket.js`, `constants.js`).
- `pb_public/`: Static assets, service worker (`sw.js`), and client-side router (`js/app-router.js`).
- `scripts/`: Collection setup, seeding, media sync, and deployment scripts.
- `tests/`: Unit tests (`node:test`).
