/**
 * Prelude — HTML Fetcher
 *
 * Fetches and parses a webpage into structured data using Cheerio.
 * Written from scratch for Prelude. Does NOT use Conservatory's fetcher.
 */

import * as cheerio from "cheerio"
import {
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  PRELUDE_USER_AGENT,
} from "../utils/constants.js"
import type { FetchedPage, HeadingNode, ImageNode, LinkNode } from "../utils/types.js"

export async function fetchPage(url: string): Promise<FetchedPage> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    let finalUrl = url
    let response: Response | null = null
    let redirectCount = 0

    // Manual redirect following to track final URL
    let currentUrl = url
    while (redirectCount <= MAX_REDIRECTS) {
      response = await fetch(currentUrl, {
        headers: {
          "User-Agent": PRELUDE_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
        signal: controller.signal,
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) break
        currentUrl = new URL(location, currentUrl).toString()
        redirectCount++
        continue
      }

      finalUrl = currentUrl
      break
    }

    if (!response || !response.ok) {
      throw new Error(`HTTP ${response?.status ?? "unknown"}: Failed to fetch ${url}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    return {
      url: finalUrl,
      statusCode: response.status,
      html,
      title: $("title").text().trim(),
      description: $('meta[name="description"]').attr("content")?.trim() ?? null,
      lang: $("html").attr("lang")?.trim() ?? null,
      charset: $("meta[charset]").length > 0 || $('meta[http-equiv="Content-Type"]').length > 0,
      viewport: $('meta[name="viewport"]').length > 0,
      canonical: $('link[rel="canonical"]').attr("href")?.trim() ?? null,
      headings: extractHeadings($),
      images: extractImages($),
      links: extractLinks($, finalUrl),
      metaTags: extractMetaTags($),
      fetchedAt: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function extractHeadings($: cheerio.CheerioAPI): HeadingNode[] {
  const headings: HeadingNode[] = []

  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tagName = ((el as any).tagName ?? "").toLowerCase()
    const level = parseInt(tagName.charAt(1), 10)
    const text = $(el).text().trim()

    if (text && !isNaN(level)) {
      headings.push({
        level,
        text: text.slice(0, 200),
        id: $(el).attr("id")?.trim() ?? null,
      })
    }
  })

  return headings
}

function extractImages($: cheerio.CheerioAPI): ImageNode[] {
  const images: ImageNode[] = []

  $("img").each((_, el) => {
    const src = $(el).attr("src")
    if (!src) return

    const alt = $(el).attr("alt")

    images.push({
      src: src.slice(0, 300),
      alt: alt?.trim() ?? null,
      hasAlt: alt !== undefined,
      width: $(el).attr("width") ?? null,
      height: $(el).attr("height") ?? null,
    })
  })

  return images
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): LinkNode[] {
  const links: LinkNode[] = []
  let baseDomain: string

  try {
    baseDomain = new URL(baseUrl).hostname
  } catch {
    baseDomain = ""
  }

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return

    let isExternal = false
    try {
      const resolved = new URL(href, baseUrl)
      isExternal = resolved.hostname !== baseDomain
    } catch {
      // relative URL — not external
    }

    links.push({
      href: href.slice(0, 300),
      text: $(el).text().trim().slice(0, 200),
      isExternal,
      rel: $(el).attr("rel")?.trim() ?? null,
    })
  })

  return links.slice(0, 100)
}

function extractMetaTags($: cheerio.CheerioAPI): Record<string, string> {
  const tags: Record<string, string> = {}

  $("meta").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("property")
    const content = $(el).attr("content")

    if (name && content) {
      tags[name] = content.slice(0, 500)
    }
  })

  return tags
}
