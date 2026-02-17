# Game Grid

Game Grid is a daily puzzle game where players guess video games based on screenshots and covers. Built with Vue 3, Vite, TypeScript, and a Node.js/Express backend that fetches data from IGDB.

## Features

- Daily 3x3 grid of games to guess
- Guess by searching game titles
- Cycle through multiple screenshots per game to get more hints
- Limited number of incorrect guesses (lives system)
- Reveal answers and share your results
- Responsive, modern UI

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or newer recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/) (for cloning the repository)
- [Twitch Developer Account](https://dev.twitch.tv/console) for IGDB API credentials
  - You need a Twitch Developer account to get a `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` for the backend.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (disable Vetur)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

To run the full app locally (frontend + backend together):

```sh
npm run dev:all
```

This starts both the Vite dev server (port 5173) and the Express API (port 3001) in parallel from the project root. The frontend will hot-reload on changes; restart the command to pick up backend changes.

If you only need the frontend (e.g. UI work with a separately running backend):

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Cypress](https://www.cypress.io/)

```sh
npm run test:e2e:dev
```

This runs the end-to-end tests against the Vite development server.
It is much faster than the production build.

But it's still recommended to test the production build with `test:e2e` before deploying (e.g. in CI environments):

```sh
npm run build
npm run test:e2e
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Backend Setup

The backend is in `/api-service` and uses Express and Axios to fetch data from IGDB.

1. Copy `api-service/.env.example` to `api-service/.env` and fill in your Twitch/IGDB credentials.
2. Install backend dependencies:
   ```sh
   npm install --prefix api-service
   ```
3. Use `npm run dev:all` from the project root to start both frontend and backend together (see above).

**Optional: persistent daily grid caching**

By default the daily grid is cached in memory and lost on server restart. To persist it across restarts, create a free [Neon](https://neon.tech) PostgreSQL project and add the connection string to `api-service/.env`:

```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
```

The table is created automatically on first server start. Leave `DATABASE_URL` unset for local development — the server works fine without it.

## Production

Frontend hosted in [Cloudflare](https://www.cloudflare.com/)
Backend api-service hosted in [Render](https://render.com/)

A `GET /health` endpoint is available on the backend for uptime monitoring. Point a service like [UptimeRobot](https://uptimerobot.com) at it with a 5-minute interval to keep the server alive on Render's free tier.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
