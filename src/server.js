
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes from './routes/auth.js'
import prospectRoutes from './routes/prospect.js'

dotenv.config()
const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }))

app.use(
  cors({
    origin: "*",
  })
);


app.use(express.json({ limit:'10mb' }))
app.use(morgan('dev'))

// serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/prospect', prospectRoutes)

const PORT = process.env.PORT || 4000
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/jktyre_db'

mongoose.connect(MONGO_URI).then(()=>{
  console.log('Mongo connected')
  app.listen(PORT, ()=> console.log('Server listening on', PORT))
}).catch(err=>{
  console.error('Mongo connection error', err)
  process.exit(1)
})
