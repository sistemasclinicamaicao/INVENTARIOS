/**
 * Proxy /api/v1/* → NestJS conservando pathname completo.
 */
import { defineEventHandler, getRequestURL, proxyRequest } from 'h3'

function apiTarget(): string {
  return (
    process.env.NUXT_API_PROXY ||
    `http://127.0.0.1:${process.env.API_PORT || '3050'}`
  ).replace(/\/$/, '')
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const target = `${apiTarget()}${url.pathname}${url.search}`
  return proxyRequest(event, target)
})
