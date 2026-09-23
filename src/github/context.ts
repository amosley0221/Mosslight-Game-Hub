import type { RepoLink } from '../core/types';
import { getGitHubToken, repoFile, repoReadme, repoTree } from './api';

const TEXT = /\.(md|txt|json|ya?ml|toml|ini|cfg|xml|html?|css|scss|js|jsx|ts|tsx|mjs|cjs|cs|cpp|cc|c|h|hpp|gd|gdshader|tscn|tres|godot|lua|py|rs|go|java|kt|swift|glsl|hlsl|wgsl|shader|usf|ush|uproject|uplugin|asmdef|gradle|sh|bat|ps1)$/i;
const JUNK = /(^|\/)(node_modules|\.git|Library|Temp|Intermediate|Binaries|DerivedDataCache|Saved|\.godot|\.import|dist|build|Builds)\//;

const MAX_PATHS = 400;
const MAX_FILE = 6000;

/**
 * A compact view of the linked GitHub repo for agents that can't see the local folder
 * (API mode, Grok, the phone): the file list, the README, and any files the message names.
 */
export async function repoContext(repo: RepoLink, message: string): Promise<string> {
  if (!(await getGitHubToken())) return '';
  try {
    const tree = await repoTree(repo.owner, repo.name, repo.branch || 'HEAD');
    const files = tree.items.filter(i => i.type === 'blob' && !JUNK.test(i.path)).map(i => i.path);
    const readme = (await repoReadme(repo.owner, repo.name).catch(() => '')).slice(0, 3000);

    // Files the user mentions by path or file name (e.g. "look at PlayerController.cs").
    const lower = message.toLowerCase();
    const mentioned = files
      .filter(p => TEXT.test(p))
      .filter(p => lower.includes(p.toLowerCase()) || lower.includes(p.split('/').pop()!.toLowerCase()))
      .slice(0, 3);
    const bodies = await Promise.all(mentioned.map(async p => {
      const text = await repoFile(repo.owner, repo.name, p, repo.branch).catch(() => '');
      return text ? `--- ${p} ---\n${text.slice(0, MAX_FILE)}${text.length > MAX_FILE ? '\n… (truncated)' : ''}` : '';
    }));

    return [
      `GitHub repository: ${repo.owner}/${repo.name} (branch ${repo.branch || 'default'}). ${files.length} files${tree.truncated ? ' (list truncated)' : ''}.`,
      'Files:',
      files.slice(0, MAX_PATHS).join('\n') + (files.length > MAX_PATHS ? `\n… and ${files.length - MAX_PATHS} more` : ''),
      readme ? `README:\n${readme}` : '',
      ...bodies.filter(Boolean),
      'If you need to see another file, name its path and ask the user to mention it in their next message.',
    ].filter(Boolean).join('\n\n');
  } catch {
    return '';
  }
}
