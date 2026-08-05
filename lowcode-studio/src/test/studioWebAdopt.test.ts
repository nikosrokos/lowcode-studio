import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateREFrameworkProject } from '../templates/reframework';
import {
  adoptStudioWebSolutionAsLcsProject,
  findLcsProjectsForSolution,
  getStudioWebLocalLink,
  linkStudioWebLocalWorkspace,
  resolveStudioWebRpaProject
} from '../interop/studioWebLocal';
import { isLcsProjectDir } from '../interop/projectResolve';

function writeRef(dir: string, name = 'AdoptDemo'): void {
  for (const file of generateREFrameworkProject(name)) {
    const full = path.join(dir, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(file.content)) {
      fs.writeFileSync(full, file.content);
    } else {
      fs.writeFileSync(full, file.content, 'utf8');
    }
  }
}

function run(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-adopt-'));
  const seedLcs = path.join(root, 'SeedLcs');
  const parent = path.join(root, 'workspace');
  fs.mkdirSync(parent, { recursive: true });
  writeRef(seedLcs, 'AdoptDemo');

  // Create a Studio Web solution from seed, then delete the seed LCS
  // to simulate "open solution folder that has only .xaml"
  const linked = linkStudioWebLocalWorkspace(seedLcs, {
    mode: 'create',
    targetDir: parent,
    solutionName: 'AdoptDemo'
  });
  const solutionDir = linked.link.solutionDir;
  assert.ok(fs.existsSync(path.join(solutionDir, 'AdoptDemo', 'Main.xaml')));
  fs.rmSync(seedLcs, { recursive: true, force: true });

  const rpa = resolveStudioWebRpaProject(solutionDir);
  assert.ok(rpa, 'must resolve RPA project under .uipx');
  assert.strictEqual(rpa!.projectFolder, 'AdoptDemo');
  assert.ok(fs.existsSync(path.join(rpa!.projectDir, 'Main.xaml')));

  // Adopt with no existing LCS → creates sibling *.lcs with .lcs.json workflows
  const adopted = adoptStudioWebSolutionAsLcsProject(solutionDir);
  assert.ok(isLcsProjectDir(adopted.lcsProjectDir));
  assert.ok(adopted.lcsProjectDir.endsWith('.lcs') || path.basename(adopted.lcsProjectDir).includes('Adopt'));
  assert.ok(fs.existsSync(adopted.mainWorkflowAbs), adopted.mainWorkflowAbs);
  assert.ok(adopted.mainWorkflowAbs.endsWith('.lcs.json'));
  assert.ok(adopted.workflows.includes('Main.lcs.json'));
  assert.ok(adopted.workflows.some((w) => w.startsWith('Framework/')));

  const link = getStudioWebLocalLink(adopted.lcsProjectDir);
  assert.ok(link);
  assert.strictEqual(path.resolve(link!.solutionDir), path.resolve(solutionDir));
  assert.strictEqual(link!.projectFolder, 'AdoptDemo');
  assert.ok(link!.files?.['Main.lcs.json']?.xamlHash);

  // Studio Web .xaml must remain (adopt must not overwrite with empty LCS)
  assert.ok(fs.existsSync(path.join(solutionDir, 'AdoptDemo', 'Main.xaml')));

  // Re-adopt finds existing LCS
  const found = findLcsProjectsForSolution(solutionDir, [path.dirname(solutionDir)]);
  assert.ok(found.includes(adopted.lcsProjectDir));

  const again = adoptStudioWebSolutionAsLcsProject(solutionDir, {
    searchRoots: [path.dirname(solutionDir)]
  });
  assert.strictEqual(
    path.resolve(again.lcsProjectDir),
    path.resolve(adopted.lcsProjectDir)
  );

  // Open-link with a different LCS should import from Studio Web (not wipe .xaml)
  const otherLcs = path.join(root, 'OtherLcs');
  writeRef(otherLcs, 'OtherLcs');
  // Clear OtherLcs workflows so open prefers Studio Web import into this folder
  for (const rel of ['Main.lcs.json', 'Framework']) {
    const p = path.join(otherLcs, rel);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  }
  // Keep a minimal project.json so it is still an LCS project
  assert.ok(isLcsProjectDir(otherLcs));

  const openLinked = linkStudioWebLocalWorkspace(otherLcs, {
    mode: 'open',
    targetDir: solutionDir,
    preferStudioWeb: true
  });
  assert.ok(fs.existsSync(path.join(otherLcs, 'Main.lcs.json')));
  assert.ok(fs.existsSync(path.join(solutionDir, 'AdoptDemo', 'Main.xaml')));
  assert.strictEqual(openLinked.link.projectFolder, 'AdoptDemo');

  console.log('studioWebAdopt.test.ts: ok');
}

run();
