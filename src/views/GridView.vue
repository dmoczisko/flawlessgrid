<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from "vue";
import type { Game } from "../types/Game";
import { getTitlePlaceholder, getGridNumber } from "../utils/gameUtils";

const isDev = import.meta.env.DEV;

const games = ref<Game[]>([]);
const gridId = ref<string | null>(null);
const isLoading = ref(true);
const isError = ref(false);
const searchInput = ref<HTMLInputElement | null>(null); // Add ref for input

const showModal = ref(false);
const selectedGame = ref<Game | null>(null);
const searchQuery = ref("");
const searchResults = ref<Game[]>([]);
const guessResult = ref<string | null>(null);
const flippedCells = ref<Set<number>>(new Set());
const buttonText = ref("Give Up & Reveal Answers");
const incorrectGuesses = ref(0);
const answersRevealed = ref(false);
const completionModal = ref(false);
const completionType = ref<"win" | "giveup" | "fail" | null>(null);

function saveProgress() {
  if (!gridId.value) return;
  localStorage.setItem(
    `gamegrid-progress-${gridId.value}`,
    JSON.stringify({
      flippedCells: Array.from(flippedCells.value),
      incorrectGuesses: incorrectGuesses.value,
      answersRevealed: answersRevealed.value,
      buttonText: buttonText.value,
      completionModal: completionModal.value,
    })
  );
}

onMounted(async () => {
  isLoading.value = true;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/games`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    games.value = data.games;
    gridId.value = data.gridId;
  } catch {
    isError.value = true;
  } finally {
    isLoading.value = false;
  }

  // Restore progress from localStorage if available
  if (gridId.value) {
    const saved = localStorage.getItem(`gamegrid-progress-${gridId.value}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          flippedCells.value = new Set(parsed.flippedCells || []);
          incorrectGuesses.value = parsed.incorrectGuesses || 0;
          answersRevealed.value = !!parsed.answersRevealed;
          buttonText.value = parsed.buttonText || "Give Up & Reveal Answers";
          if (parsed.completionModal) completionModal.value = true;
        }
      } catch {
        /* ignore */
      }
    }
  }
});

watch(
  [flippedCells, incorrectGuesses, answersRevealed, buttonText, completionModal, gridId],
  () => {
    // Change button text to "Summary" if the game is completed (win, fail, or giveup)
    if (
      flippedCells.value.size === 9 ||
      incorrectGuesses.value >= 5 ||
      answersRevealed.value
    ) {
      buttonText.value = "Summary";
    } else {
      buttonText.value = "Give Up & Reveal Answers";
    }
    saveProgress();
  },
  { deep: true }
);

const screenshotIndices = ref(new Map<number, number>());
const modalScreenshotIndex = ref(0);

function getScreenshotCount(game: Game): number {
  return game.screenshots?.length ?? 0;
}

function getScreenshotUrlAt(game: Game, index: number): string {
  const shots = game.screenshots;
  if (!shots || shots.length === 0) return "";
  const url = shots[Math.min(index, shots.length - 1)]?.url ?? "";
  return url.replace(/t_\w+/, "t_1080p").replace(/^\/\//, "https://");
}

function getScreenshotUrl(game: Game): string {
  const index = screenshotIndices.value.get(game.id!) ?? 0;
  return getScreenshotUrlAt(game, index);
}

function cycleScreenshot(game: Game, direction: 1 | -1) {
  const count = getScreenshotCount(game);
  if (count <= 1) return;
  const current = screenshotIndices.value.get(game.id!) ?? 0;
  screenshotIndices.value.set(game.id!, (current + direction + count) % count);
}

function getModalScreenshotUrl(): string {
  return selectedGame.value
    ? getScreenshotUrlAt(selectedGame.value, modalScreenshotIndex.value)
    : "";
}

function cycleModalScreenshot(direction: 1 | -1) {
  const count = getScreenshotCount(selectedGame.value!);
  if (count <= 1) return;
  modalScreenshotIndex.value =
    (modalScreenshotIndex.value + direction + count) % count;
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

function openModal(game: Game) {
  selectedGame.value = game;
  showModal.value = true;
  searchQuery.value = "";
  searchResults.value = [];
  guessResult.value = null;
  modalScreenshotIndex.value = 0;
  nextTick(() => {
    searchInput.value?.focus();
  });
}

function closeModal() {
  showModal.value = false;
  selectedGame.value = null;
  searchQuery.value = "";
  searchResults.value = [];
  guessResult.value = null;
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function searchGames() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  if (!searchQuery.value) {
    searchResults.value = [];
    return;
  }
  searchDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/search?query=${encodeURIComponent(
          searchQuery.value
        )}`
      );
      if (!res.ok) {
        searchResults.value = [];
        return;
      }
      searchResults.value = await res.json();
    } catch {
      searchResults.value = [];
    }
  }, 300);
}

function checkCompletion() {
  if (flippedCells.value.size === 9) {
    completionType.value = "win";
    completionModal.value = true;
  } else if (incorrectGuesses.value >= 5) {
    completionType.value = "fail";
    completionModal.value = true;
  } else if (answersRevealed.value) {
    completionType.value = "giveup";
    completionModal.value = true;
  }
}

function makeGuess(game: Game) {
  if (selectedGame.value && game.id === selectedGame.value.id) {
    guessResult.value = "Correct!";
    flippedCells.value.add(game.id!);
    setTimeout(() => {
      closeModal();
      checkCompletion();
      saveProgress();
    }, 1000);
  } else {
    guessResult.value = "Incorrect!";
    incorrectGuesses.value++;
    if (incorrectGuesses.value >= 5) {
      revealAll();
      checkCompletion();
      saveProgress();
    }
  }
}

const revealAll = () => {
  buttonText.value = "Summary";
  closeModal();
  answersRevealed.value = true;
  checkCompletion();
  saveProgress();
};

function resetGrid() {
  if (gridId.value) localStorage.removeItem(`gamegrid-progress-${gridId.value}`);
  flippedCells.value = new Set();
  incorrectGuesses.value = 0;
  answersRevealed.value = false;
  buttonText.value = "Give Up & Reveal Answers";
  completionModal.value = false;
  completionType.value = null;
  screenshotIndices.value = new Map();
  closeModal();
}

const gridNumber = computed(() => (gridId.value ? getGridNumber(gridId.value) : null));

const showCopyToast = ref(false);

function shareResult() {
  // Build a grid of emojis: 🟩 for correct, 🟥 for incorrect, ⬜ for not guessed
  let grid = "";
  let idx = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const game = games.value[idx];
      if (flippedCells.value.has(game.id!)) {
        grid += "🟩";
      } else if (answersRevealed.value) {
        grid += "⬜";
      } else {
        grid += "🟥";
      }
      idx++;
    }
    grid += "\n";
  }
  const url = window.location.origin;
  const text = `GameGrid #${gridNumber.value} ${flippedCells.value.size}/9\n${grid}\n${url}`;
  navigator.clipboard.writeText(text);
  showCopyToast.value = true;
  setTimeout(() => {
    showCopyToast.value = false;
  }, 2000);
  saveProgress();
}

// Helper function for the mini grid in the completion modal
function getMiniGridClass(idx: number) {
  const game = games.value[idx];
  if (!game) return "";
  if (flippedCells.value.has(game.id!)) {
    return "mini-green";
  } else {
    return "mini-gray";
  }
}
</script>

<template>
  <div v-if="gridNumber" class="grid-id">Grid #{{ gridNumber }}</div>

  <div class="guess-counter">Incorrect guesses: {{ incorrectGuesses }} / 5</div>

  <div class="grid-outer">
    <div class="grid-container">
      <template v-if="isLoading">
        <div v-for="n in 9" :key="'skeleton-' + n" class="grid-cell skeleton">
          <div class="card-inner">
            <div class="card-front">
              <div class="skeleton-img"></div>
              <div class="skeleton-bar"></div>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="isError">
        <div class="load-error">
          Failed to load today's grid. Please try refreshing the page.
        </div>
      </template>
      <template v-else>
        <div
          v-for="(game, idx) in games"
          :key="game.id || idx"
          class="grid-cell"
          :class="{
            flipped: flippedCells.has(game.id!) || answersRevealed,
            'not-guessed': answersRevealed && !flippedCells.has(game.id!),
          }"
          @click="!flippedCells.has(game.id!) && !answersRevealed && openModal(game)"
        >
          <div class="card-inner">
            <div class="card-front">
              <img
                v-if="getScreenshotUrl(game)"
                :src="getScreenshotUrl(game)"
                :alt="' screenshot'"
                class="game-cover"
              />
              <div
                v-if="getScreenshotCount(game) > 1"
                class="screenshot-nav"
              >
                <button class="screenshot-nav-btn" @click.stop="cycleScreenshot(game, -1)">&#8249;</button>
                <span class="screenshot-nav-dots">
                  {{ (screenshotIndices.get(game.id!) ?? 0) + 1 }} / {{ getScreenshotCount(game) }}
                </span>
                <button class="screenshot-nav-btn" @click.stop="cycleScreenshot(game, 1)">&#8250;</button>
              </div>
              <div class="year-bar">
                {{ getTitlePlaceholder(game.name) }} ({{ getReleaseYear(game) }})
              </div>
            </div>
            <div class="card-back">
              <img
                v-if="getCoverUrl(game)"
                :src="getCoverUrl(game)"
                :alt="game.name + ' cover'"
                class="game-cover"
              />
              <div class="year-bar">
                {{ game.name }}<br />({{ getReleaseYear(game) }})
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <button class="close-btn" @click="closeModal">&times;</button>
        <div class="guess-counter modal-guess-counter">
          Incorrect guesses: {{ incorrectGuesses }} / 5
        </div>
        <h3 class="modal-guess-title">Guess the Game</h3>
        <div v-if="selectedGame" class="modal-screenshot-wrapper">
          <img
            v-if="getModalScreenshotUrl()"
            :src="getModalScreenshotUrl()"
            :alt="' screenshot'"
            class="modal-screenshot"
          />
          <img
            v-else-if="getCoverUrl(selectedGame)"
            :src="getCoverUrl(selectedGame)"
            :alt="' cover'"
            class="modal-screenshot"
          />
          <div v-if="getScreenshotCount(selectedGame) > 1" class="screenshot-nav modal-nav">
            <button class="screenshot-nav-btn" @click="cycleModalScreenshot(-1)">&#8249;</button>
            <span class="screenshot-nav-dots">
              {{ modalScreenshotIndex + 1 }} / {{ getScreenshotCount(selectedGame) }}
            </span>
            <button class="screenshot-nav-btn" @click="cycleModalScreenshot(1)">&#8250;</button>
          </div>
        </div>
        <input
          ref="searchInput"
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
  <button v-if="isDev" class="reset-btn" @click="resetGrid">↺ Reset (dev)</button>

  <div v-if="completionModal" class="modal-overlay" @click.self="completionModal = false">
    <div class="modal completion-modal modern-modal">
      <button class="close-btn" @click="completionModal = false">&times;</button>
      <div class="completion-content">
        <h2 class="completion-title summary-title">Summary</h2>
        <div class="summary-details">
          <div class="summary-grid-number">Video Game Grid #{{ gridNumber }}</div>
        </div>
        <div class="mini-emoji-grid">
          <div v-for="row in 3" :key="'mini-row-' + row" class="mini-emoji-row">
            <span
              v-for="col in 3"
              :key="'mini-col-' + col"
              :class="['mini-emoji-cell', getMiniGridClass((row - 1) * 3 + (col - 1))]"
            ></span>
          </div>
        </div>
      </div>
      <div class="summary-score">You got {{ flippedCells.size }} out of 9</div>
      <div class="share-btn-row bottom-row">
        <button class="share-btn small" @click="shareResult">
          <svg
            class="share-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
      </div>
    </div>
  </div>

  <div v-if="showCopyToast" class="copy-toast">Result copied to clipboard!</div>

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
  width: 100%;
  padding: 0 12px;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(3, 300px);
  grid-template-rows: repeat(3, 300px);
  gap: 24px;
}

.grid-cell {
  perspective: 1000px;
  position: relative;
  background: #1c1c1c;
  border: 1.5px solid rgba(255, 255, 255, 0.07);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  min-width: 300px;
  min-height: 300px;
  display: flex;
  align-items: flex-end; // So the year bar is always at the bottom
  justify-content: center;
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
  padding: 0;
  cursor: pointer;
}

.grid-cell:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  border-color: rgba(255, 255, 255, 0.18);
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
  border: 2px solid #e53935 !important;
  box-shadow: 0 0 0 1px rgba(229, 57, 53, 0.25), 0 4px 20px rgba(229, 57, 53, 0.15) !important;
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
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 1rem;
  text-align: center;
  padding: 10px 0.5rem 8px 0.5rem;
  border-radius: 0 0 14px 14px;
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
  border-radius: 14px;
}

.year-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.88));
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  text-align: center;
  padding: 2.5rem 0.5rem 0.65rem 0.5rem;
  border-bottom-left-radius: 14px;
  border-bottom-right-radius: 14px;
  z-index: 2;
  letter-spacing: 0.2px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal {
  background: #1a1a1a;
  color: #fff;
  padding: 2.5rem 2rem;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 400px;
  min-height: 350px;
  max-width: 700px;
  max-height: 90vh;
  width: 90vw;
  height: auto;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  overflow-y: auto;
}
@media (max-width: 600px) {
  .modal {
    min-width: 90vw;
    max-width: 98vw;
    padding: 1.2rem 0.75rem;
    max-height: 85vh;
  }
  .modal-screenshot {
    max-height: 200px;
  }
  .modal-guess-title {
    font-size: 1.5rem;
    margin: 0.4rem 0 0.6rem 0;
  }
  .modal-guess-counter {
    font-size: 1.1rem;
    margin-bottom: 0.3rem;
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
  font-size: 1.18rem;
  padding: 0.7rem;
  border-radius: 8px;
  border: 1.5px solid #444;
  margin-bottom: 1.2rem;
  background: #23272f;
  color: #fff;
  font-family: "Inter", "Segoe UI", "Roboto", Arial, sans-serif;
}
.search-input::placeholder {
  color: #bbb;
  opacity: 1;
}
.search-results {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
  max-height: 280px;
  overflow-y: auto;
}
.search-results li {
  font-size: 1.13rem;
  padding: 0.7rem 0.5rem;
  border-radius: 6px;
  margin-bottom: 0.2rem;
  transition: background 0.18s;
}
.search-results li:hover {
  background: #333;
}
.guess-result {
  font-size: 1.35rem;
  font-weight: 700;
  margin-top: 1.2rem;
  text-align: center;
  letter-spacing: 0.01em;
  font-family: "Inter", "Segoe UI", "Roboto", Arial, sans-serif;
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
  border: 2px solid #4caf50;
  box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.3), 0 4px 20px rgba(76, 175, 80, 0.15);
}
.give-up-btn {
  margin: 2rem auto 1.5rem auto;
  display: block;
  background: transparent;
  color: #666;
  border: 1px solid #2e2e2e;
  border-radius: 8px;
  padding: 0.5rem 1.4rem;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.4px;
}
.give-up-btn:hover {
  background: #1e1e1e;
  border-color: #444;
  color: #aaa;
}
.reset-btn {
  display: block;
  margin: 0 auto 1rem auto;
  background: none;
  border: 1px dashed #555;
  color: #888;
  border-radius: 6px;
  padding: 0.4rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.reset-btn:hover {
  border-color: #aaa;
  color: #ccc;
}
.grid-id {
  width: 100%;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: #4caf50;
  margin-top: 1.5rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  opacity: 0.8;
}

.guess-counter {
  width: 100%;
  text-align: center;
  margin: 0.4rem 0 1.4rem 0;
  font-weight: 500;
  font-size: 0.88rem;
  color: #666;
  letter-spacing: 0.4px;
}

.igdb-footer {
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

.skeleton {
  background: #1c1c1c;
  border: 1.5px solid rgba(255, 255, 255, 0.05);
  animation: pulse 1.4s infinite ease-in-out;
  cursor: default;
}
.skeleton-img {
  width: 100%;
  height: 80%;
  background: #262626;
  border-radius: 14px 14px 0 0;
  margin-bottom: 0.5rem;
}
.skeleton-bar {
  width: 60%;
  height: 16px;
  background: #202020;
  border-radius: 6px;
  margin: 0 auto 1rem auto;
}
@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.copy-toast {
  position: fixed;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  background: #222;
  color: #fff;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  z-index: 5000;
  opacity: 0.97;
  pointer-events: none;
  transition: opacity 0.3s;
}

.modal.completion-modal.modern-modal {
  min-width: 520px;
  min-height: 480px;
  width: 540px;
  height: 520px;
  max-width: 900px;
  max-height: 98vh;
}
@media (max-width: 900px) {
  .modal.completion-modal.modern-modal {
    min-width: 90vw !important;
    max-width: 98vw !important;
    width: 98vw !important;
    height: auto !important;
    min-height: 350px !important;
    max-height: 98vh !important;
    padding: 1.2rem 0.5rem !important;
  }
}
.modern-modal {
  background: #23272f !important;
  color: #fff !important;
  font-family: "Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif !important;
  font-size: 1.15rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  text-align: center;
}
.completion-title.answers-revealed {
  font-size: 2.7rem !important;
  color: #4caf50 !important;
  font-weight: 900 !important;
  margin-bottom: 0.5rem;
  letter-spacing: 0.03em;
  text-align: center;
}
.bottom-row {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  margin-top: 1.5rem;
  width: 100%;
}
.share-btn.small {
  cursor: pointer;
  font-size: 1rem;
  padding: 0.5rem 1.2rem;
  min-width: 120px;
  border-radius: 5px;
  margin: 0 auto;
}

.summary-title {
  font-size: 2.3rem;
  font-weight: 900;
  color: #fff;
  margin-bottom: 0.5rem;
  letter-spacing: 0.02em;
  text-align: center;
}
.mini-emoji-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 1.2rem 0 0.5rem 0;
  gap: 0.5rem; // Add vertical spacing between rows
}
.mini-emoji-row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 0.5rem; // Add horizontal spacing between cells
}
.mini-emoji-cell {
  width: 2.1rem;
  height: 2.1rem;
  display: inline-block;
  border-radius: 4px;
  margin: 0 0.18em;
  vertical-align: middle;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
.mini-green {
  background: #4caf50;
}
.mini-gray {
  background: #bdbdbd;
}
.summary-details {
  margin-bottom: 0.7rem;
  text-align: center;
}
.summary-grid-number {
  font-size: 1.15rem;
  color: #81c784;
  font-weight: 600;
  margin-bottom: 0.1rem;
}
.summary-score {
  font-size: 1.13rem;
  color: #fff;
  font-weight: 500;
}

.load-error {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  font-size: 1.2rem;
  color: #e57373;
  font-weight: 600;
}

.screenshot-nav {
  position: absolute;
  bottom: 44px; // sits just above the year-bar
  left: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  z-index: 3;
  opacity: 0;
  transition: opacity 0.2s;
}

.grid-cell:hover .screenshot-nav {
  opacity: 1;
}

.screenshot-nav-btn {
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  padding: 0;
}

.screenshot-nav-btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

.screenshot-nav-dots {
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  min-width: 36px;
  text-align: center;
}

.modal-nav {
  position: relative;
  bottom: auto;
  opacity: 1;
  margin-top: 0.6rem;
  justify-content: center;
}

.modal-nav .screenshot-nav-dots {
  color: #ccc;
  text-shadow: none;
}

/* Add styles for modal screenshot and improved modal UI */
.modal-guess-title {
  font-size: 2.1rem;
  font-weight: 800;
  color: #fff;
  text-align: center;
  margin: 0.7rem 0 1.1rem 0;
  letter-spacing: 0.01em;
  font-family: "Inter", "Segoe UI", "Roboto", Arial, sans-serif;
}
.modal-guess-counter {
  font-size: 1.35rem;
  font-weight: 700;
  color: #e57373;
  text-align: center;
  margin-bottom: 0.5rem;
  letter-spacing: 0.01em;
  font-family: "Inter", "Segoe UI", "Roboto", Arial, sans-serif;
}
.modal-screenshot-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-bottom: 1.2rem;
}
.modal-screenshot {
  width: 100%;
  max-height: 400px;
  height: auto;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  object-fit: cover;
  display: block;
  margin: 0 auto;
}

@media (max-width: 900px) {
  .grid-container {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: none;
    gap: 16px;
    width: 100%;
  }
  .grid-cell {
    aspect-ratio: 1;
    min-width: 0;
    min-height: 0;
    max-width: none;
    max-height: none;
  }
}

@media (max-width: 600px) {
  .grid-container {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    gap: 12px;
    width: 100%;
  }
  .grid-cell {
    aspect-ratio: 16/9;
    min-width: 0;
    min-height: 0;
    max-width: none;
    max-height: none;
  }
}
</style>
