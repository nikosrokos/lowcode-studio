import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';

export interface PackagedStudioArchives {
  /** Studio Web Import project format (ZIP renamed .uip) */
  uipPath: string;
  /** Solution-style bundle for CLI / Studio Web upload (.uis) — only when includeUis */
  uisPath?: string;
  projectName: string;
}

export interface PackageStudioOptions {
  /** When true, also write a `.uis` solution archive. Default false (Export .uip only). */
  includeUis?: boolean;
}

/**
 * Package an exported Portable Studio Web folder as:
 * - `.uip` — zip of project files (Studio Web → Import project)
 * - `.uis` — optional solution wrapper zip with `.uipx` + project folder
 */
export function packageStudioWebArchives(
  exportedProjectDir: string,
  destinationDir?: string,
  options: PackageStudioOptions = {}
): PackagedStudioArchives {
  if (!fs.existsSync(exportedProjectDir)) {
    throw new Error(`Export folder not found: ${exportedProjectDir}`);
  }
  const projectJsonPath = path.join(exportedProjectDir, 'project.json');
  if (!fs.existsSync(projectJsonPath)) {
    throw new Error('Exported folder is missing project.json');
  }

  const manifest = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8')) as {
    name?: string;
    main?: string;
    description?: string;
    projectVersion?: string;
  };
  const projectName = sanitize(
    manifest.name || path.basename(exportedProjectDir).replace(/\.StudioWeb$/i, '')
  );
  const outDir = destinationDir || path.dirname(exportedProjectDir);
  fs.mkdirSync(outDir, { recursive: true });

  const uipPath = uniquePath(outDir, `${projectName}.uip`);

  // .uip = flat project zip (what Studio Web Download/Import uses)
  const uipZip = new AdmZip();
  addDirectoryToZip(uipZip, exportedProjectDir, '');
  // Skip markdown noise inside the importable archive
  removeZipEntries(uipZip, (name) =>
    /(^|\/)(README_STUDIO_WEB|OPEN_IN_STUDIO_WEB)\.md$/i.test(name)
  );
  uipZip.writeZip(uipPath);

  let uisPath: string | undefined;
  if (options.includeUis) {
    uisPath = uniquePath(outDir, `${projectName}.uis`);
    const uisZip = new AdmZip();
    const solutionId = crypto.randomUUID();
    const uipx = {
      schemaVersion: '1.0',
      name: projectName,
      description: manifest.description || `${projectName} from LowCode Studio`,
      solutionId,
      version: manifest.projectVersion || '1.0.0',
      projects: [
        {
          name: projectName,
          path: `projects/${projectName}`,
          type: 'Process',
          main: manifest.main || 'Main.xaml'
        }
      ],
      createdWith: 'LowCode Studio',
      target: 'StudioWeb'
    };
    uisZip.addFile(
      `${projectName}.uipx`,
      Buffer.from(JSON.stringify(uipx, null, 2) + '\n', 'utf8')
    );
    addDirectoryToZip(uisZip, exportedProjectDir, `projects/${projectName}`);
    removeZipEntries(uisZip, (name) =>
      /(^|\/)(README_STUDIO_WEB|OPEN_IN_STUDIO_WEB)\.md$/i.test(name)
    );
    uisZip.writeZip(uisPath);
  }

  return { uipPath, uisPath, projectName };
}

function addDirectoryToZip(zip: AdmZip, dir: string, zipPrefix: string): void {
  const walk = (current: string, prefix: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }
      const abs = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        zip.addLocalFile(
          abs,
          path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel),
          path.posix.basename(rel)
        );
      }
    }
  };
  walk(dir, zipPrefix.replace(/\\/g, '/'));
}

function removeZipEntries(zip: AdmZip, predicate: (name: string) => boolean): void {
  for (const entry of [...zip.getEntries()]) {
    if (predicate(entry.entryName.replace(/\\/g, '/'))) {
      zip.deleteFile(entry);
    }
  }
}

function sanitize(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'Project';
}

function uniquePath(dir: string, fileName: string): string {
  const full = path.join(dir, fileName);
  if (!fs.existsSync(full)) {
    return full;
  }
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let i = 2;
  while (fs.existsSync(path.join(dir, `${base}_${i}${ext}`))) {
    i += 1;
  }
  return path.join(dir, `${base}_${i}${ext}`);
}
