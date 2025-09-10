
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import Prospect from '../models/Prospect.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random()*1e9)
    const ext = path.extname(file.originalname)
    cb(null, unique + ext)
  }
})
const upload = multer({ storage })

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message:'No file' })
  const file = req.file
  res.json({ ok:true, file:{
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`
  }})
})

router.post('/createOnBoard', async (req, res) => {
  try {
    const payload = req.body || {}
    const doc = await Prospect.create({
      mobile: payload.mobile,
      fullName: payload.fullName,
      shopName: payload.shopName,
      address: payload.address,
      upi: payload.upi,
      files: payload.files || []
    })
    res.json({ ok:true, data: doc })
  } catch (e) {
    console.error(e); res.status(500).json({ ok:false, message:'Failed to create' })
  }
})

router.post('/generate-paymentLink', async (req, res) => {
  try {
    const { upi } = req.body || {}
    const url = `https://pay.example.com/${Date.now()}`
    res.json({ ok:true, url, upi: upi || null })
  } catch (e) {
    console.error(e); res.status(500).json({ ok:false, message:'Failed to generate link' })
  }
})

export default router
