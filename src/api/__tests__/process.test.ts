// Imports
// -----------------------------------------------------------------------------
// Node.js
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'

// External
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Internal
import { PannonicoError } from '../pannonico-error.js'
import { runCommand } from '../run-command.js'
import { startProcess } from '../start-process.js'

// Types
import type { ChildProcess } from 'node:child_process'

// Constants
// -----------------------------------------------------------------------------
const NATIVE = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: NATIVE.spawn }))

// Functions
// -----------------------------------------------------------------------------
/** Provide Node events and streams without a process so unit tests can control each lifecycle transition. */
const createChild = (): ChildProcess =>
  Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  }) as unknown as ChildProcess

// Tests
// -----------------------------------------------------------------------------
let child: ChildProcess
beforeEach(() => {
  vi.unstubAllEnvs()
  NATIVE.spawn.mockReset()
  child = createChild()
  NATIVE.spawn.mockReturnValue(child)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Expect process invocation to select only the package-local CLI', () => {
  test.each([
    ['capture', ['ignore', 'pipe', 'pipe']],
    ['watch', ['ignore', 'inherit', 'inherit']],
    ['mcp', ['pipe', 'pipe', 'pipe']],
  ] as const)('when running in %s mode', async (mode, stdio) => {
    const session = startProcess(['build', '--out=a b'], {}, mode)
    expect(session.child).toBe(child)
    expect(NATIVE.spawn).toHaveBeenCalledExactlyOnceWith(
      process.execPath,
      [
        fileURLToPath(new URL('../../bin/pannonico.js', import.meta.url)),
        'build',
        '--out=a b',
      ],
      { cwd: process.cwd(), env: { ...process.env }, stdio },
    )
    child.emit('close', 0, null)
    expect(await session.completed).toMatchObject({ exitCode: 0, signal: null })
  })

  test('when cwd and environment overlay are supplied', async () => {
    vi.stubEnv('API_UNIT_PARENT', 'inherited')
    vi.stubEnv('API_UNIT_REMOVE', 'present')
    const before = { ...process.env }
    const originalDirectory = process.cwd()
    const execution = Object.freeze({
      cwd: 'workspace',
      env: Object.freeze({
        API_UNIT_PARENT: 'child',
        API_UNIT_REMOVE: undefined,
      }),
    })
    const session = startProcess(['--version'], execution, 'capture')
    const options = NATIVE.spawn.mock.calls[0]![2]
    expect(options.cwd).toBe(path.resolve('workspace'))
    expect(options.env.API_UNIT_PARENT).toBe('child')
    expect(Object.hasOwn(options.env, 'API_UNIT_REMOVE')).toBe(false)
    expect(process.env).toEqual(before)
    expect(process.cwd()).toBe(originalDirectory)
    child.emit('close', 0, null)
    await session.completed
  })
})

describe('Expect finite output to remain exact until process closure', () => {
  test('when exit precedes final UTF-8 bytes and close', async () => {
    const pending = runCommand(['build'], {})
    let settled = false
    void pending.then(() => {
      settled = true
    })
    const stdout = child.stdout as PassThrough
    const stderr = child.stderr as PassThrough
    stdout.write('first ')
    stderr.write('warning\n')
    child.emit('exit', 0, null)
    await Promise.resolve()
    expect(settled).toBe(false)
    stdout.write('last ')
    stdout.write(Buffer.from([0xc4]))
    stdout.write(Buffer.from([0x8d]))
    stdout.write('\n')
    child.emit('close', 0, null)
    expect(await pending).toEqual({
      exitCode: 0,
      signal: null,
      stdout: 'first last č\n',
      stderr: 'warning\n',
    })
  })

  test.each(['watch', 'mcp'] as const)(
    'when %s streams belong to the caller',
    async mode => {
      const session = startProcess([mode], {}, mode)
      expect(child.stdout!.listenerCount('data')).toBe(0)
      expect(child.stderr!.listenerCount('data')).toBe(0)
      child.stdout!.emit('data', 'caller output')
      child.stderr!.emit('data', 'caller diagnostic')
      child.emit('close', 0, null)
      expect(await session.completed).toEqual({
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
      })
    },
  )
})

describe('Expect failures to retain status, diagnostics and original causes', () => {
  test.each([1, 2, 3, 4])(
    'when the CLI exits with class %s',
    async exitCode => {
      const session = startProcess(['build'], {}, 'capture')
      const rejected = expect(session.completed).rejects.toMatchObject({
        name: 'PannonicoError',
        result: {
          exitCode,
          signal: null,
          stdout: 'report',
          stderr: 'diagnostic',
        },
      })
      child.stdout!.emit('data', 'report')
      child.stderr!.emit('data', 'diagnostic')
      child.emit('close', exitCode, null)
      await rejected
    },
  )

  test('when the process is terminated by a signal', async () => {
    const session = startProcess(['watch'], {}, 'watch')
    const rejected = expect(session.completed).rejects.toMatchObject({
      result: { exitCode: null, signal: 'SIGTERM' },
    })
    child.emit('close', null, 'SIGTERM')
    await rejected
  })

  test('when Node emits an asynchronous startup error', async () => {
    const cause = Object.assign(new Error('missing directory'), {
      code: 'ENOENT',
    })
    const session = startProcess(['build'], {}, 'capture')
    const rejected = expect(session.completed).rejects.toMatchObject({
      cause,
      result: { exitCode: -2, signal: null },
    })
    child.emit('error', cause)
    child.emit('close', -2, null)
    await rejected
  })

  test('when Node throws synchronously during spawn', async () => {
    const cause = new TypeError('invalid spawn input')
    NATIVE.spawn.mockImplementation(() => {
      throw cause
    })
    expect(() => startProcess(['mcp'], {}, 'mcp')).toThrow(PannonicoError)
    await expect(runCommand(['build'], {})).rejects.toMatchObject({
      name: 'PannonicoError',
      cause,
      result: undefined,
    })
  })
})

describe('Expect PannonicoError to preserve the public error contract', () => {
  test('when a process result and cause are present', () => {
    const result = { exitCode: 4, signal: null }
    const cause = new Error('original')
    const error = new PannonicoError('failed', result, { cause })
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('PannonicoError')
    expect(error.message).toBe('failed')
    expect(error.result).toBe(result)
    expect(error.cause).toBe(cause)
  })
  test('when no process could be created', () => {
    const error = new PannonicoError('failed')
    expect(error.result).toBeUndefined()
    expect(error.cause).toBeUndefined()
  })
})
