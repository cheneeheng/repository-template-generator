import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/items', (_req, res) => {
  // TODO: replace with real database query using pool from db.js
  res.json([
    { id: 1, name: 'Item one' },
    { id: 2, name: 'Item two' },
  ])
})

app.listen(PORT, () => {
  console.log(`{{PROJECT_NAME}} backend listening on port ${PORT}`)
})
