import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { callTool } from '../lib/api'

interface DirectoryEntry {
  name: string
  type: 'directory' | 'file' | 'other'
}

interface FileResult {
  path: string
  content: string
}

interface ExplorerProps {
  enabled: boolean
}

export function Explorer({ enabled }: ExplorerProps) {
  const [directory, setDirectory] = useState('.')
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [activeFile, setActiveFile] = useState('')
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const requestId = useRef(0)

  const dirty = activeFile !== '' && content !== savedContent

  const loadDirectory = useCallback(
    async (nextDirectory: string) => {
      if (!enabled) return
      const id = ++requestId.current
      setLoading(true)
      setError('')
      try {
        const response = await callTool<DirectoryEntry[]>('fs.list', { path: nextDirectory })
        if (id !== requestId.current) return
        setDirectory(nextDirectory)
        setEntries(
          [...response.result].sort((a, b) => {
            if (a.type !== b.type)
              return a.type === 'directory' ? -1 : b.type === 'directory' ? 1 : 0
            return a.name.localeCompare(b.name)
          }),
        )
        setDurationMs(response.durationMs)
      } catch (nextError) {
        if (id === requestId.current) setError(messageOf(nextError))
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [enabled],
  )

  const openFile = useCallback(
    async (filePath: string) => {
      if (dirty && !window.confirm('Discard unsaved file changes?')) return
      setLoading(true)
      setError('')
      try {
        const response = await callTool<FileResult>('fs.read', { path: filePath })
        setActiveFile(filePath)
        setContent(response.result.content)
        setSavedContent(response.result.content)
        setDurationMs(response.durationMs)
      } catch (nextError) {
        setError(messageOf(nextError))
      } finally {
        setLoading(false)
      }
    },
    [dirty],
  )

  const saveFile = useCallback(async () => {
    if (!activeFile || !dirty) return
    setLoading(true)
    setError('')
    try {
      const response = await callTool<{ path: string; bytes: number }>('fs.write', {
        path: activeFile,
        content,
      })
      setSavedContent(content)
      setDurationMs(response.durationMs)
    } catch (nextError) {
      setError(messageOf(nextError))
    } finally {
      setLoading(false)
    }
  }, [activeFile, content, dirty])

  useEffect(() => {
    if (enabled) void loadDirectory('.')
  }, [enabled, loadDirectory])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveFile()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveFile])

  const breadcrumbs = useMemo(() => {
    if (directory === '.') return [{ name: 'root', path: '.' }]
    const parts = directory.split('/').filter(Boolean)
    return [
      { name: 'root', path: '.' },
      ...parts.map((name, index) => ({ name, path: parts.slice(0, index + 1).join('/') })),
    ]
  }, [directory])

  return (
    <section class="workspace-card explorer-card">
      <div class="section-heading explorer-heading">
        <div>
          <p class="label">Repository</p>
          <div class="breadcrumbs">
            {breadcrumbs.map((item, index) => (
              <button type="button" onClick={() => void loadDirectory(item.path)} key={item.path}>
                {index > 0 ? '/ ' : ''}
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <button
          class="icon-button"
          type="button"
          onClick={() => void loadDirectory(directory)}
          title="Refresh files"
        >
          ↻
        </button>
      </div>

      <div class="explorer-layout">
        <div class="file-list" aria-busy={loading}>
          {directory !== '.' && (
            <button
              class="file-row"
              type="button"
              onClick={() => void loadDirectory(parentOf(directory))}
            >
              <span class="file-kind">DIR</span>
              <strong>..</strong>
            </button>
          )}
          {entries.map((entry) => {
            const target = joinRelative(directory, entry.name)
            return (
              <button
                class={`file-row ${activeFile === target ? 'active' : ''}`}
                type="button"
                key={`${entry.type}:${entry.name}`}
                onClick={() =>
                  entry.type === 'directory' ? void loadDirectory(target) : void openFile(target)
                }
                disabled={entry.type === 'other'}
              >
                <span class="file-kind">
                  {entry.type === 'directory' ? 'DIR' : entry.type === 'file' ? 'FILE' : '—'}
                </span>
                <strong>{entry.name}</strong>
              </button>
            )
          })}
          {!loading && entries.length === 0 && <p class="empty compact">No entries.</p>}
        </div>

        <div class="editor-shell">
          <div class="editor-bar">
            <span title={activeFile}>{activeFile || 'Select a file'}</span>
            <div class="editor-actions">
              {durationMs !== null && <small>{durationMs} ms</small>}
              {dirty && <span class="dirty-dot" title="Unsaved changes" />}
              <button
                class="button small"
                type="button"
                onClick={() => void saveFile()}
                disabled={!dirty || loading}
              >
                Save
              </button>
            </div>
          </div>
          {activeFile ? (
            <textarea
              class="editor"
              value={content}
              onInput={(event) => setContent(event.currentTarget.value)}
              spellcheck={false}
              aria-label={`Editing ${activeFile}`}
            />
          ) : (
            <div class="editor-empty">Choose a UTF-8 file from the repository.</div>
          )}
        </div>
      </div>
      {error && <p class="inline-error">{error}</p>}
    </section>
  )
}

function joinRelative(directory: string, name: string): string {
  return directory === '.' ? name : `${directory}/${name}`
}

function parentOf(directory: string): string {
  const parts = directory.split('/').filter(Boolean)
  parts.pop()
  return parts.length > 0 ? parts.join('/') : '.'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
