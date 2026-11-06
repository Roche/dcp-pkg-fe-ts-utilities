import { existsSync, copyFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';

interface MoveConfigPluginOptions {
  distDir?: string;
  srcSubdir?: string;
  fileName?: string;
}

export default function moveConfigPlugin(options: MoveConfigPluginOptions = {}) {
  const {
    distDir = 'dist',
    srcSubdir = 'src',
    fileName = 'config.js'
  } = options;

  return {
    name: 'move-config-and-cleanup',
    apply: 'build',
    closeBundle() {
      const dist = resolve(process.cwd(), distDir);
      const srcConfigPath = join(dist, srcSubdir, fileName);
      const rootConfigPath = join(dist, fileName);
      const srcDir = join(dist, srcSubdir);

      if (existsSync(srcConfigPath)) {
        copyFileSync(srcConfigPath, rootConfigPath);
        console.log('✅ Moved', fileName, 'to', dist);
      }

      if (existsSync(srcDir)) {
        rmSync(srcDir, { recursive: true, force: true });
        console.log('✅ Removed', srcDir);
      }
    }
  };
}