<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

interface Game {
  id: number;
  name: string;
  cover?: { url: string };
  screenshots?: { url: string }[];
  first_release_date?: number;
}

const games = ref<Game[]>([]);
const gridId = ref<string | null>(null);

onMounted(async () => {
  const res = await fetch("http://localhost:3001/api/games");
  const data = await res.json();
  games.value = data.games;
  gridId.value = data.gridId;
});

function getScreenshotUrl(game: Game) {
  return game.screenshots && game.screenshots.length > 0
    ? game.screenshots[0].url.replace(/t_\w+/, "t_1080p").replace(/^\/\//, "https://")
    : "";
}

function getCoverUrl(game: Game) {
  if (game.cover?.url) {
    return game.cover.url.replace("t_thumb", "t_1080p").replace(/^\/\//, "https://");
  } else if (game.screenshots && game.screenshots.length > 0) {
    return game.screenshots[0].url
      .replace(/t_\w+/, "t_1080p")
      .replace(/^\/\//, "https://");
  }
  return "";
}

function getReleaseYear(game: Game) {
  return game.first_release_date
    ? new Date(game.first_release_date * 1000).getFullYear()
    : "N/A";
}

const showModal = ref(false);
const selectedGame = ref<Game | null>(null);
const searchQuery = ref("");
const searchResults = ref<Game[]>([]);
const guessResult = ref<string | null>(null);
const flippedCells = ref<Set<number>>(new Set());
const buttonText = ref("Give Up & Reveal Answers");
const incorrectGuesses = ref(0);
const answersRevealed = ref(false);

function openModal(game: Game) {
  selectedGame.value = game;
  showModal.value = true;
  searchQuery.value = "";
  searchResults.value = [];
  guessResult.value = null;
}

function closeModal() {
  showModal.value = false;
  selectedGame.value = null;
  searchQuery.value = "";
  searchResults.value = [];
  guessResult.value = null;
}

async function searchGames() {
  if (!searchQuery.value) {
    searchResults.value = [];
    return;
  }
  const res = await fetch(
    `http://localhost:3001/api/search?query=${encodeURIComponent(searchQuery.value)}`
  );
  searchResults.value = await res.json();
}

function makeGuess(game: Game) {
  console.log("Guessing:", game.id, "Expected:", selectedGame.value?.id);
  if (selectedGame.value && game.id === selectedGame.value.id) {
    guessResult.value = "Correct!";
    flippedCells.value.add(game.id);
    setTimeout(() => {
      closeModal();
    }, 1000);
  } else {
    guessResult.value = "Incorrect!";
    incorrectGuesses.value++;
    if (incorrectGuesses.value >= 5) {
      revealAll();
    }
  }
}

function getTitlePlaceholder(game: Game) {
  if (!game.name) return "";
  // Split by words and punctuation, keep colons and other punctuation
  const tokens = game.name.trim().split(/(\s+|[:.,!?;])/);
  return tokens
    .map((token) => (/\w+/.test(token) ? "_" : token))
    .join("")
    .replace(/\s+/g, " ");
}

const revealAll = () => {
  buttonText.value = "Answers Revealed";
  closeModal();
  answersRevealed.value = true;
};

// Helper to generate a sequential grid number based on the date
function getGridNumber(dateStr: string): number {
  // Example: count days since a fixed start date (e.g., Jan 1, 2024)
  const start = new Date("2025-01-01");
  const current = new Date(dateStr);
  const diff = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1; // Grid #1 is Jan 1, 2024
}

const gridNumber = computed(() => (gridId.value ? getGridNumber(gridId.value) : null));
</script>

<template>
  <div v-if="gridNumber" class="grid-id">Grid #{{ gridNumber }}</div>

  <div class="guess-counter">Incorrect guesses: {{ incorrectGuesses }} / 5</div>

  <div class="grid-outer">
    <div class="grid-container">
      <div
        v-for="(game, idx) in games"
        :key="game.id || idx"
        class="grid-cell"
        :class="{
          flipped: flippedCells.has(game.id) || answersRevealed,
          'not-guessed': answersRevealed && !flippedCells.has(game.id),
        }"
        @click="!flippedCells.has(game.id) && !answersRevealed && openModal(game)"
      >
        <div class="card-inner">
          <div class="card-front">
            <img
              v-if="getScreenshotUrl(game)"
              :src="getScreenshotUrl(game)"
              :alt="' screenshot'"
              class="game-cover"
            />
            <img
              v-else-if="getCoverUrl(game)"
              :src="getCoverUrl(game)"
              :alt="' cover'"
              class="game-cover"
            />
            <div class="year-bar">
              {{ getTitlePlaceholder(game) }} ({{ getReleaseYear(game) }})
            </div>
          </div>
          <div class="card-back">
            <img
              v-if="getCoverUrl(game)"
              :src="getCoverUrl(game)"
              :alt="game.name + ' cover'"
              class="game-cover"
            />
            <div class="year-bar">{{ game.name }}<br />({{ getReleaseYear(game) }})</div>
          </div>
        </div>
      </div>
    </div>
    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <button class="close-btn" @click="closeModal">&times;</button>
        <div class="guess-counter">Incorrect guesses: {{ incorrectGuesses }} / 5</div>
        <h3>Guess the Game</h3>
        <input
          v-model="searchQuery"
          @input="searchGames"
          placeholder="Search for a game title..."
          class="search-input"
        />
        <ul v-if="searchResults.length" class="search-results">
          <li v-for="result in searchResults" :key="result.id" @click="makeGuess(result)">
            <img
              v-if="result.cover && result.cover.url"
              :src="
                result.cover.url.replace(/t_\w+/, 't_thumb').replace(/^\/\//, 'https://')
              "
              alt="cover"
              style="
                width: 32px;
                height: 32px;
                object-fit: cover;
                margin-right: 8px;
                border-radius: 4px;
                vertical-align: middle;
              "
            />
            <span>{{ result.name }}</span>
            <span
              v-if="result.first_release_date"
              style="color: #aaa; margin-left: 8px; font-size: 0.95em"
              >({{ new Date(result.first_release_date * 1000).getFullYear() }})</span
            >
          </li>
        </ul>
        <div
          v-if="guessResult"
          class="guess-result"
          :class="{ incorrect: guessResult === 'Incorrect!' }"
        >
          {{ guessResult }}
        </div>
      </div>
    </div>
  </div>
  <button class="give-up-btn" @click="revealAll">{{ buttonText }}</button>

  <footer class="igdb-footer">
    <span
      >Game data provided by
      <a href="https://www.igdb.com/" target="_blank" rel="noopener" class="igdb-link"
        ><img
          src="https://www.igdb.com/packs/static/igdbLogo-bcd49db90003ee7cd4f4.svg"
          alt="IGDB logo"
          class="igdb-logo"
        />
        IGDB.com</a
      ></span
    >
  </footer>
</template>

<style scoped lang="scss">
.grid-outer {
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(3, 300px);
  grid-template-rows: repeat(3, 300px);
  gap: 24px;
}

@media (max-width: 900px) {
  .grid-container {
    grid-template-columns: repeat(2, 45vw);
    grid-template-rows: repeat(5, 45vw);
    gap: 16px;
  }
  .grid-cell {
    min-width: 45vw;
    min-height: 45vw;
    max-width: 90vw;
    max-height: 90vw;
  }
}

@media (max-width: 600px) {
  .grid-container {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    gap: 12px;
  }
  .grid-cell {
    min-width: 90vw;
    min-height: 40vw;
    max-width: 95vw;
    max-height: 60vw;
  }
}

.grid-cell {
  perspective: 1000px;
  position: relative;
  background: #ccc;
  border: 2px solid #000;
  transition: border-color 0.3s;
  min-width: 300px;
  min-height: 300px;
  display: flex;
  align-items: flex-end; // So the year bar is always at the bottom
  justify-content: center;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 0;
  cursor: pointer;
}

.grid-cell:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  filter: brightness(0.97);
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform-style: preserve-3d;
}

.grid-cell.flipped .card-inner {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.card-back {
  background: #222;
  color: #fff;
  transform: rotateY(180deg);
  z-index: 2;
  padding-bottom: 0.5rem;
}

.grid-cell.flipped .card-back .year-bar {
  color: #4caf50;
  font-weight: bold;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}

.grid-cell.not-guessed {
  border: 3px solid #e53935 !important;
}
.grid-cell.not-guessed .card-back .year-bar {
  color: #e53935 !important;
  font-weight: bold;
}

.card-back .game-cover {
  opacity: 0.7;
  filter: blur(1px);
}

.card-back .year-bar {
  background: rgba(80, 80, 80, 0.9);
  color: #fff;
  font-size: 1.1rem;
  text-align: center;
  padding: 10px 0 6px 0;
  border-radius: 0 0 12px 12px;
  z-index: 3;
  width: 100%;
}

.game-cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
  border-radius: 12px;
}

.year-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: rgba(80, 80, 80, 0.7);
  color: #fff;
  font-size: 1.1rem;
  text-align: center;
  padding: 6px 0;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  z-index: 2;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal {
  background: #222;
  color: #fff;
  padding: 2.5rem 2rem;
  border-radius: 18px;
  min-width: 400px;
  min-height: 350px;
  max-width: 700px;
  max-height: 90vh;
  width: 90vw;
  height: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
}
@media (max-width: 600px) {
  .modal {
    min-width: 90vw;
    max-width: 98vw;
    padding: 1.2rem 0.5rem;
  }
}
.close-btn {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  color: #fff;
  font-size: 2rem;
  cursor: pointer;
}
.search-input {
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  border: 1px solid #444;
  font-size: 1rem;
}
.search-results {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
  max-height: 200px;
  overflow-y: auto;
}
.search-results li {
  padding: 0.5rem;
  cursor: pointer;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
}
.search-results li img {
  width: 32px;
  height: 32px;
  object-fit: cover;
  margin-right: 8px;
  border-radius: 4px;
  vertical-align: middle;
}
.search-results li:hover {
  background: #333;
}
.guess-result {
  font-size: 1.2rem;
  font-weight: bold;
  margin-top: 1rem;
  text-align: center;
}
.guess-result {
  color: #4caf50;
}
.guess-result:empty {
  color: inherit;
}
.guess-result.incorrect {
  color: #e57373;
}
.grid-cell.selected {
  border: 3px solid #222;
}
.grid-cell.flipped {
  border: 3px solid #4caf50;
}
.give-up-btn {
  margin: 2.5rem auto 2rem auto;
  display: block;
  background: #e57373;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.7rem 1.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.give-up-btn:hover {
  background: #d32f2f;
}
.grid-id {
  width: 100%;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 600;
  color: #4caf50;
  margin-top: 1.2rem;
  letter-spacing: 1px;
}

.guess-counter {
  width: 100%;
  text-align: center;
  margin: 1.2rem 0;
  font-weight: 700;
}

.igdb-footer {
  width: 100vw;
  background: #181818;
  color: #bbb;
  text-align: center;
  padding: 1.5rem 0 1.2rem 0;
  font-size: 1.05rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 2rem;
  position: fixed;
  left: 0;
  bottom: 0;
  z-index: 3000;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.12);
  span {
    display: flex;
    align-items: center;
  }
}
body {
  padding-bottom: 80px;
}

@media (max-width: 600px) {
  .igdb-footer {
    display: flex;
    align-items: center;
    width: 100%;
    box-shadow: none;
    margin-top: 2.5rem;
  }
  body {
    padding-bottom: 0;
  }
}
.igdb-link {
  color: #4caf50;
  text-decoration: none;
  margin-left: 5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.2s;
}
.igdb-link:hover {
  color: #81c784;
}
.igdb-logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  vertical-align: middle;
  border-radius: 6px;
  padding: 2px;
}
</style>
