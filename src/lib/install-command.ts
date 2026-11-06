import type { RegistrySkill } from '#/lib/directory.ts'

/** `npx skills add` command for a registry skill, matching the ui-skills site. */
export function buildInstallCommand(skill: Pick<RegistrySkill, 'user' | 'repo' | 'name'>) {
  return `npx skills add https://github.com/${skill.user}/${skill.repo} --skill ${skill.name}`
}
