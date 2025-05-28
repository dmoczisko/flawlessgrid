export interface Game {
  id?: number
  name: string
  cover?: { url: string }
  screenshots?: { url: string }[]
  first_release_date?: number
}
