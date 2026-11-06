/**
 * Links the main checkout's `.env.local` into this git worktree, so local secrets (e.g.
 * OPENROUTER_API_KEY) live in one place and every new worktree picks them up on install.
 * Does nothing in the main checkout, when this worktree already has a `.env.local`, or when
 * the main checkout has none.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const FILE = '.env.local'

function git(...args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

try {
  const root = git('rev-parse', '--show-toplevel')
  const mainRoot = dirname(resolve(root, git('rev-parse', '--git-common-dir')))
  const source = join(mainRoot, FILE)
  const target = join(root, FILE)

  const targetExists = existsSync(target) || isDanglingLink(target)
  if (mainRoot !== root && !targetExists && existsSync(source)) {
    symlinkSync(source, target)
    console.log(`Linked ${FILE} from ${mainRoot}`)
  }
} catch {
  // Not a git checkout (e.g. a tarball install): nothing to link.
}

function isDanglingLink(path: string) {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}
