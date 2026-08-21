interface RepositoryStats {
  forks_count: number
  open_issues_count: number
  stargazers_count: number
}

interface PublishedRelease {
  at: string
  body: string
  name: string | null
  tag: string
  url: string
}

type JsonObject = Record<string, unknown>
type Validator<T> = (value: unknown) => value is T

const REPOSITORY_API = 'https://api.github.com/repos/DuarteSantos8/openGym'

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRepositoryStats(value: unknown): value is RepositoryStats {
  return (
    isObject(value) &&
    typeof value.forks_count === 'number' &&
    typeof value.open_issues_count === 'number' &&
    typeof value.stargazers_count === 'number'
  )
}

function isPublishedRelease(value: unknown): value is PublishedRelease {
  return (
    isObject(value) &&
    typeof value.at === 'string' &&
    typeof value.body === 'string' &&
    (typeof value.name === 'string' || value.name === null) &&
    typeof value.tag === 'string' &&
    typeof value.url === 'string'
  )
}

function readCachedJson<T>(key: string, validate: Validator<T>): T | undefined {
  const cached = sessionStorage.getItem(key)
  if (!cached) return undefined

  const value: unknown = JSON.parse(cached)
  return validate(value) ? value : undefined
}

function setRepositoryMetric(id: string, value: string | number): void {
  document.querySelectorAll<HTMLElement>(`[data-gh="${id}"]`).forEach(element => {
    element.textContent = String(value)
  })
}

// Live GitHub numbers in the nav + open-source strip. Fails silently — the site
// works fine without them (unauthenticated API: 60 req/h per IP, cached below).
async function updateRepositoryStats(): Promise<void> {
  try {
    let stats = readCachedJson('gh_repo', isRepositoryStats)

    if (!stats) {
      const response = await fetch(REPOSITORY_API)
      if (!response.ok) return

      const responseData: unknown = await response.json()
      if (!isRepositoryStats(responseData)) return

      stats = {
        forks_count: responseData.forks_count,
        open_issues_count: responseData.open_issues_count,
        stargazers_count: responseData.stargazers_count,
      }
      sessionStorage.setItem('gh_repo', JSON.stringify(stats))
    }

    setRepositoryMetric('stars', `★ ${stats.stargazers_count}`)
    setRepositoryMetric('stars-n', stats.stargazers_count)
    setRepositoryMetric('forks-n', stats.forks_count)
    setRepositoryMetric('issues-n', stats.open_issues_count)
  } catch {
    // Offline, rate-limited, or cached data is invalid: leave the static placeholders.
  }
}

function toPublishedRelease(value: unknown): PublishedRelease | undefined {
  if (
    !isObject(value) ||
    value.draft !== false ||
    value.prerelease !== false ||
    typeof value.tag_name !== 'string' ||
    (typeof value.name !== 'string' && value.name !== null) ||
    typeof value.published_at !== 'string' ||
    (typeof value.body !== 'string' && value.body !== null) ||
    typeof value.html_url !== 'string'
  ) {
    return undefined
  }

  return {
    at: value.published_at,
    body: value.body ?? '',
    name: value.name,
    tag: value.tag_name,
    url: value.html_url,
  }
}

function isPublishedReleaseList(value: unknown): value is PublishedRelease[] {
  return Array.isArray(value) && value.every(isPublishedRelease)
}

async function fetchPublishedReleases(): Promise<PublishedRelease[] | undefined> {
  const cached = readCachedJson('gh_releases', isPublishedReleaseList)
  if (cached) return cached

  const response = await fetch(`${REPOSITORY_API}/releases?per_page=100`)
  if (!response.ok) return undefined

  const responseData: unknown = await response.json()
  if (!Array.isArray(responseData)) return undefined

  const releases = responseData
    .map(toPublishedRelease)
    .filter((release): release is PublishedRelease => release !== undefined)
  sessionStorage.setItem('gh_releases', JSON.stringify(releases))
  return releases
}

function formatReleaseDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Extract the first paragraph of the notes, rejoin hard-wrapped lines, and remove
// the small subset of Markdown used in release summaries.
function releaseBlurb(markdown: string): string {
  const lines = markdown.replace(/\r/g, '').split('\n')
  const start = lines.findIndex(line => line.trim() && !line.trim().startsWith('#'))
  if (start < 0) return ''

  const paragraph: string[] = []
  for (let index = start; index < lines.length && lines[index]?.trim(); index += 1) {
    paragraph.push(lines[index]?.trim() ?? '')
  }

  const text = paragraph
    .join(' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>]/g, '')
  return text.length > 220
    ? `${text.slice(0, 217).replace(/\s+\S*$/, '')}…`
    : text
}

function appendRelease(timeline: HTMLElement, release: PublishedRelease): void {
  const item = document.createElement('li')
  const heading = document.createElement('b')
  const when = document.createElement('span')
  const summary = document.createElement('p')
  const notes = document.createElement('a')
  const releaseTitle = release.name && release.name !== release.tag ? release.name : release.tag

  heading.textContent = releaseTitle.startsWith(release.tag)
    ? releaseTitle
    : `${release.tag} — ${releaseTitle}`
  when.className = 'when'
  when.textContent = formatReleaseDate(release.at)
  summary.textContent = `${releaseBlurb(release.body)} `
  notes.href = release.url
  notes.rel = 'noopener'
  notes.textContent = 'notes →'

  summary.appendChild(notes)
  item.append(heading, when, summary)
  timeline.appendChild(item)
}

// About page: build the milestones timeline from published GitHub releases. Static
// fallback entries remain when the API is unreachable; the first hand-written entry
// is always kept.
async function updateReleaseTimeline(): Promise<void> {
  const timeline = document.getElementById('milestones')
  if (!timeline) return

  try {
    const releases = await fetchPublishedReleases()
    if (!releases?.length) return

    timeline.querySelectorAll('[data-fallback]').forEach(element => element.remove())
    releases
      .slice()
      .reverse()
      .forEach(release => appendRelease(timeline, release))
  } catch {
    // Offline, rate-limited, or cached data is invalid: keep the fallback entries.
  }
}

void updateRepositoryStats()
void updateReleaseTimeline()
