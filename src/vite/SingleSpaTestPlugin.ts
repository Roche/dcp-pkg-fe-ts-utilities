import type { Plugin } from 'vite';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface SingleSpaTestPluginOptions {
    /**
     * Props to pass to the single-spa lifecycle methods
     */
    props?: Record<string, any>;

    /**
     * SystemJS CDN URL
     * @default 'https://cdn.jsdelivr.net/npm/systemjs/dist/system.min.js'
     */
    systemJsUrl?: string;

    /**
     * Entry file name
     * @default 'main.js'
     */
    entryFile?: string;

    /**
     * Node environment
     * @default 'production'
     */
    nodeEnv?: 'production' | 'development';
}

const defaultTemplate = (options: Required<SingleSpaTestPluginOptions>) => `<!DOCTYPE html>
<html>

<head>
  <script>
    window.process = {
      env: {
        NODE_ENV: '${options.nodeEnv}'
      }
    };
  </script>
  <script src="${options.systemJsUrl}"></script>
</head>

<body>
  <script>
    System.import('./${options.entryFile}').then(async (m) => {
      console.log("1. Module loaded. Simulating single-spa lifecycles...");

      const props = ${JSON.stringify(options.props, null, 6)};

      try {
        console.log("2. Calling bootstrap()...");
        await m.bootstrap(props);
        console.log("3. Bootstrap finished successfully.");

        console.log("4. Calling mount()...");
        const mountPromise = m.mount(props);

        await mountPromise;
        console.log("5. Mount finished successfully! The app should be visible.");

      } catch (err) {
        console.error("❌ Simulation failed:", err);
      }
    });
  </script>
</body>

</html>`;

export function singleSpaTestPlugin(options: SingleSpaTestPluginOptions = {}): Plugin {
    const fullOptions: Required<SingleSpaTestPluginOptions> = {
        props: options.props || { name: 'test-app', customProp: 'hello' },
        systemJsUrl: options.systemJsUrl || 'https://cdn.jsdelivr.net/npm/systemjs/dist/system.min.js',
        entryFile: options.entryFile || 'main.js',
        nodeEnv: options.nodeEnv || 'production'
    };

    return {
        name: 'single-spa-test-plugin',

        apply: 'build',

        closeBundle() {
            const outDir = join(process.cwd(), 'dist');
            const outputPath = join(outDir, 'index.html');

            const htmlContent = defaultTemplate(fullOptions);
            writeFileSync(outputPath, htmlContent, 'utf-8');
            console.log(`✅ Generated test index.html in dist folder`);
        }
    };
}