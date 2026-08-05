import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export interface AccessTokenPayload {
  sub: string
  role: string
}

export interface RefreshTokenPayload {
  sub: string
  tokenId: string
}

export function signAccessToken(user: { id: string; role: string }): string {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl as jwt.SignOptions['expiresIn'],
  })
}

export function signRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign({ sub: userId, tokenId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload
}
