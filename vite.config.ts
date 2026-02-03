import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({ tsDecorators: true }),
    runApiServer(),
  ],
})

function runApiServer() {
  const rootDir = path.dirname(fileURLToPath(import.meta.url))
  const serverDir = path.join(rootDir, 'server')

  let serverProcess: ReturnType<typeof spawn> | null = null
  let isRestarting = false
  let pendingRestart = false

  const run = (command: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { stdio: 'inherit' })
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
      })
    })

  const stopServer = () =>
    new Promise<void>((resolve) => {
      if (!serverProcess) return resolve()
      const proc = serverProcess
      serverProcess = null
      proc.once('exit', () => resolve())
      proc.kill('SIGTERM')
    })

  const startServer = () => {
    serverProcess = spawn('bun', ['dist/server/index.js'], {
      stdio: 'inherit',
      env: { ...process.env },
    })
    serverProcess.on('exit', () => {
      serverProcess = null
    })
  }

  const restart = async () => {
    if (isRestarting) {
      pendingRestart = true
      return
    }
    isRestarting = true
    try {
      await stopServer()
      await run('bun', ['run', 'build:server'])
      startServer()
    } catch (err) {
      console.error('[run-api-server] failed to restart:', err)
    } finally {
      isRestarting = false
      if (pendingRestart) {
        pendingRestart = false
        restart()
      }
    }
  }

  return {
    name: 'run-api-server',
    apply: 'serve',
    configureServer(viteServer) {
      restart()

      viteServer.watcher.add(serverDir)
      const onChange = (file: string) => {
        if (file.startsWith(serverDir)) restart()
      }
      viteServer.watcher.on('change', onChange)
      viteServer.watcher.on('add', onChange)
      viteServer.watcher.on('unlink', onChange)

      viteServer.httpServer?.once('close', () => {
        stopServer()
      })
    },
  }
}
