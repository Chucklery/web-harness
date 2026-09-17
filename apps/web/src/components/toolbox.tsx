import { useState } from 'preact/hooks'
import { callTool } from '../lib/api'

interface ProcessResult {
  command: string
  args: string[]
  stdout: string
  stderr: string
  durationMs: number
}

interface GitResult {
  stdout: string
  stderr: string
  durationMs: number
}

interface ToolboxProps {
  enabled: boolean
}

export function Toolbox({ enabled }: ToolboxProps) {
  const [tab, setTab] = useState<'git' | 'run'>('git')
  const [gitView, setGitView] = useState<'status' | 'diff'>('status')
  const [gitOutput, setGitOutput] = useState('Run Git status or diff to inspect the working tree.')
  const [command, setCommand] = useState('git')
  const [argsText, setArgsText] = useState('status\n--short\n--branch')
  const [cwd, setCwd] = useState('.')
  const [runOutput, setRunOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadGit = async (view: 'status' | 'diff') => {
    setBusy(true)
    setError('')
    try {
      const tool = view === 'status' ? 'git.status' : 'git.diff'
      const response = await callTool<GitResult>(tool)
      setGitView(view)
      setGitOutput(
        response.result.stdout ||
          response.result.stderr ||
          (view === 'status' ? 'Working tree clean.' : 'No unstaged diff.'),
      )
    } catch (nextError) {
      setError(messageOf(nextError))
    } finally {
      setBusy(false)
    }
  }

  const runCommand = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await callTool<ProcessResult>('process.run', {
        command,
        args: argsText.split('\n').filter((value) => value.length > 0),
        cwd,
      })
      const output = [response.result.stdout, response.result.stderr]
        .filter((value) => value.length > 0)
        .join('\n')
      setRunOutput(output || `Exited without output in ${response.result.durationMs} ms.`)
    } catch (nextError) {
      setError(messageOf(nextError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="workspace-card toolbox-card">
      <div class="tabs" role="tablist" aria-label="Repository tools">
        <button class={tab === 'git' ? 'active' : ''} type="button" onClick={() => setTab('git')}>
          Git
        </button>
        <button class={tab === 'run' ? 'active' : ''} type="button" onClick={() => setTab('run')}>
          Run
        </button>
      </div>

      {tab === 'git' ? (
        <div class="tool-pane">
          <div class="section-heading">
            <div>
              <p class="label">Working tree</p>
              <h3>{gitView === 'status' ? 'Git status' : 'Git diff'}</h3>
            </div>
            <div class="button-group">
              <button
                class={`button small ${gitView === 'status' ? 'active' : ''}`}
                type="button"
                onClick={() => void loadGit('status')}
                disabled={!enabled || busy}
              >
                Status
              </button>
              <button
                class={`button small ${gitView === 'diff' ? 'active' : ''}`}
                type="button"
                onClick={() => void loadGit('diff')}
                disabled={!enabled || busy}
              >
                Diff
              </button>
            </div>
          </div>
          <pre class="terminal-output">{gitOutput}</pre>
        </div>
      ) : (
        <div class="tool-pane">
          <div class="section-heading">
            <div>
              <p class="label">Structured argv</p>
              <h3>Run command</h3>
            </div>
            <button
              class="button small primary"
              type="button"
              onClick={() => void runCommand()}
              disabled={!enabled || busy || !command.trim()}
            >
              Run
            </button>
          </div>
          <label class="field">
            <span>Executable</span>
            <input
              value={command}
              onInput={(event) => setCommand(event.currentTarget.value)}
              spellcheck={false}
            />
          </label>
          <label class="field">
            <span>
              Arguments <small>one per line</small>
            </span>
            <textarea
              value={argsText}
              onInput={(event) => setArgsText(event.currentTarget.value)}
              spellcheck={false}
            />
          </label>
          <label class="field">
            <span>Working directory</span>
            <input
              value={cwd}
              onInput={(event) => setCwd(event.currentTarget.value)}
              spellcheck={false}
            />
          </label>
          <pre class="terminal-output run-output">
            {runOutput || 'Command output appears here.'}
          </pre>
        </div>
      )}

      {error && <p class="inline-error">{error}</p>}
    </section>
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
