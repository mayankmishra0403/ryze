import { mkdirSync } from 'node:fs'
import { join, extname, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { config } from '../config.js'

/** Resolve the configured upload dir to an absolute path under process.cwd(). */
export function uploadRoot(): string {
  return isAbsolute(config.uploadDir)
    ? config.uploadDir
    : join(process.cwd(), config.uploadDir)
}

mkdirSync(uploadRoot(), { recursive: true })

const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
const ALLOWED_DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

function makeStorage(subdir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = join(uploadRoot(), subdir)
      mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (_req, file, cb) => {
      const safeName = `${randomUUID()}${extname(file.originalname).toLowerCase()}`
      cb(null, safeName)
    },
  })
}

function fileFilter(allowed: string[]) {
  return (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`Unsupported file type: ${file.mimetype}`))
  }
}

export const uploadAvatar = multer({
  storage: makeStorage('avatars'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE),
})

export const uploadNote = multer({
  storage: makeStorage('notes'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_DOCS),
})

export function publicFileUrl(subdir: string, filename: string): string {
  return `/uploads/${subdir}/${filename}`
}
