import { Game } from '../src/types/Game'
import dotenv from 'dotenv'
import express, { Request, Response } from 'express'
import axios from 'axios'
import cors from 'cors'
import { neon } from '@neondatabase/serverless'

dotenv.config()

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

if (db) {
  db`CREATE TABLE IF NOT EXISTS daily_grid (date TEXT PRIMARY KEY, games JSONB NOT NULL)`
    .catch(err => console.error('DB setup error:', err))
}

const app = express()
const corsOrigin = process.env.ALLOWED_ORIGIN
app.use(cors(corsOrigin ? { origin: corsOrigin } : {}))

let accessToken = ''
let tokenExpiry = 0

let cachedGrid: { date: string; games: Game[] } = { date: '', games: [] }

const searchRateLimit = new Map<string, { count: number; resetTime: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = searchRateLimit.get(ip)
  if (!record || now > record.resetTime) {
    searchRateLimit.set(ip, { count: 1, resetTime: now + 60_000 })
    return false
  }
  if (record.count >= 30) return true
  record.count++
  return false
}

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of searchRateLimit.entries()) {
    if (now > record.resetTime) searchRateLimit.delete(ip)
  }
}, 5 * 60_000)

// Simple seeded random number generator
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Generate deterministic "random" selection based on date
function selectGamesForDate(games: Game[], date: string, count: number = 9): Game[] {
  const dateNum = new Date(date).getTime()
  const selectedGames = []
  const usedIndexes = new Set<number>()

  let seedOffset = 0
  while (selectedGames.length < count && usedIndexes.size < games.length) {
    const random = seededRandom(dateNum + seedOffset)
    const idx = Math.floor(random * games.length)

    if (!usedIndexes.has(idx)) {
      selectedGames.push(games[idx])
      usedIndexes.add(idx)
    }
    seedOffset++
  }

  return selectedGames
}

// Get Twitch access token
async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken
  const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
  })
  accessToken = res.data.access_token
  tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000
  return accessToken
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// Fix for Express/TypeScript async handler overload error
// Use a non-async handler and call an async IIFE inside
app.get('/api/games', (req: Request, res: Response) => {
  ;(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10) // e.g., '2024-05-30'
      if (cachedGrid.date === today && cachedGrid.games.length > 0) {
        return res.json({ games: cachedGrid.games, gridId: cachedGrid.date })
      }

      // Check DB for today's grid before hitting IGDB
      if (db) {
        try {
          const rows = await db`SELECT games FROM daily_grid WHERE date = ${today}`
          if (rows.length > 0) {
            cachedGrid = { date: today, games: rows[0].games as Game[] }
            return res.json({ games: cachedGrid.games, gridId: today })
          }
        } catch (dbErr) {
          console.error('DB read error, falling back to IGDB:', dbErr)
        }
      }

      const now = new Date()
      // Get the timestamp for the start of the current month
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthTimestamp = Math.floor(firstOfMonth.getTime() / 1000)

      const token = await getAccessToken()
      // Fetch up to 500 games (IGDB max) sorted consistently by popularity.
      // Sorting by total_rating_count desc ensures the same stable pool every day,
      // so the date-seeded selection always produces a unique, non-repeating grid.
      const igdbRes = await axios.post(
        'https://api.igdb.com/v4/games',
        `fields name, id, cover.url, screenshots.url, first_release_date, rating, total_rating_count, summary; \
         where screenshots != null \
           & cover != null \
           & first_release_date != null \
           & first_release_date < ${monthTimestamp} \
           & rating > 60 \
           & total_rating_count > 10 \
           & summary != null; \
         sort total_rating_count desc; \
         limit 500;`,
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID as string,
            Authorization: `Bearer ${token}`,
          },
        },
      )

      // Removes duplicate game names, keep first occurrence
      const allGames = igdbRes.data
      const uniqueGames: Game[] = []
      const seenNames = new Set<string>()
      for (const game of allGames) {
        if (!seenNames.has(game.name)) {
          uniqueGames.push(game)
          seenNames.add(game.name)
        }
      }
      // Randomly selects 9 games
      const selectedGames = selectGamesForDate(uniqueGames, today)
      cachedGrid = { date: today, games: selectedGames }

      // Persist to DB (fire-and-forget — don't block the response)
      if (db) {
        db`INSERT INTO daily_grid (date, games) VALUES (${today}, ${JSON.stringify(selectedGames)}) ON CONFLICT (date) DO NOTHING`
          .catch(err => console.error('DB write error:', err))
      }

      res.json({ games: selectedGames, gridId: today })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error('IGDB error:', err.response?.data || err.message)
        res.status(500).json({ error: err.message, details: err.response?.data })
      } else if (err instanceof Error) {
        res.status(500).json({ error: err.message })
      } else {
        res.status(500).json({ error: 'Unknown error' })
      }
    }
  })()
})

app.get('/api/search', (req: Request, res: Response) => {
  ;(async () => {
    try {
      const query = req.query.query as string
      if (!query || query.trim().length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' })
      }
      const sanitizedQuery = query.replace(/["\\;]/g, '').trim()
      if (sanitizedQuery.length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' })
      }
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip ?? 'unknown'
      if (isRateLimited(ip)) {
        return res.status(429).json({ error: 'Too many requests, please slow down.' })
      }
      const token = await getAccessToken()
      const igdbRes = await axios.post(
        'https://api.igdb.com/v4/games',
        `search "${sanitizedQuery}"; fields name, id, first_release_date, cover.url; limit 10;`,
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID as string,
            Authorization: `Bearer ${token}`,
          },
        },
      )
      res.json(igdbRes.data)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error('IGDB search error:', err.response?.data || err.message)
        res.status(500).json({ error: err.message, details: err.response?.data })
      } else if (err instanceof Error) {
        res.status(500).json({ error: err.message })
      } else {
        res.status(500).json({ error: 'Unknown error' })
      }
    }
  })()
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
