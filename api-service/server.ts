import { Game } from '../src/types/Game'
import dotenv from 'dotenv'
import express, { Request, Response } from 'express'
import axios from 'axios'
import cors from 'cors'

dotenv.config()

const app = express()
app.use(cors())

let accessToken = ''
let tokenExpiry = 0

let cachedGrid: { date: string; games: Game[] } = { date: '', games: [] }

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

// Fix for Express/TypeScript async handler overload error
// Use a non-async handler and call an async IIFE inside
app.get('/api/games', (req: Request, res: Response) => {
  ;(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10) // e.g., '2024-05-30'
      if (cachedGrid.date === today && cachedGrid.games.length === 9) {
        return res.json({ games: cachedGrid.games, gridId: cachedGrid.date })
      }
      const now = new Date()
      // Get the timestamp for the start of the current month
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthTimestamp = Math.floor(firstOfMonth.getTime() / 1000)

      const token = await getAccessToken()
      // Fetch 50 games released before the current month
      const igdbRes = await axios.post(
        'https://api.igdb.com/v4/games',
        `fields name, cover.url, screenshots.url, first_release_date; where screenshots != null & first_release_date != null & first_release_date < ${monthTimestamp}; limit 50;`,
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID as string,
            Authorization: `Bearer ${token}`,
          },
        },
      )
      // Randomly select 9 games
      const allGames = igdbRes.data
      const selectedGames = []
      const usedIndexes = new Set<number>()
      while (selectedGames.length < 9 && usedIndexes.size < allGames.length) {
        const idx = Math.floor(Math.random() * allGames.length)
        if (!usedIndexes.has(idx)) {
          selectedGames.push(allGames[idx])
          usedIndexes.add(idx)
        }
      }
      cachedGrid = { date: today, games: selectedGames }
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
      if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' })
      }
      const token = await getAccessToken()
      const igdbRes = await axios.post(
        'https://api.igdb.com/v4/games',
        `search "${query}"; fields name, id, first_release_date, cover.url; limit 10;`,
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
