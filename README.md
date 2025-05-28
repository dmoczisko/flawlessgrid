# Game Grid

Game Grid is a daily puzzle game where players guess video games based on screenshots and covers. Built with Vue 3, Vite, TypeScript, and a Node.js/Express backend that fetches data from IGDB.

## Features

- Daily 3x3 grid of games to guess
- Guess by searching game titles
- Limited number of incorrect guesses (lives system)
- Reveal answers and share your results
- Responsive, modern UI

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (disable Vetur)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
cd .\src\
npm install
```

### Compile and Hot-Reload for Development

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

1. Copy `.env.example` to `.env` and fill in your Twitch/IGDB credentials.
2. Install dependencies:
   ```sh
   cd api-service
   npm install
   ```
3. Start the server:
   ```sh
   npx ts-node server.ts
   ```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
