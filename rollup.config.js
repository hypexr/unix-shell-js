import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  // Browser bundle for index.js (UnixShell)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/browser/index.js',
      format: 'iife',
      name: 'UnixShellModule',
      extend: true,
      footer:
        'if (typeof window !== "undefined") { window.UnixShell = UnixShellModule.UnixShell || UnixShellModule.default; }',
    },
    plugins: [
      nodeResolve(),
      typescript({
        declaration: false,
        declarationMap: false,
        sourceMap: false,
        target: 'ES2015',
        module: 'ES2015',
        lib: ['ES2015', 'DOM'],
        compilerOptions: {
          outDir: null,
          rootDir: './src',
        },
      }),
    ],
  },
  // Browser bundle for vi-editor.js (ViEditor)
  {
    input: 'src/vi-editor.ts',
    output: {
      file: 'dist/browser/vi-editor.js',
      format: 'iife',
      name: 'ViEditorModule',
      extend: true,
      footer:
        'if (typeof window !== "undefined") { window.ViEditor = ViEditorModule.ViEditor || ViEditorModule.default; }',
    },
    plugins: [
      nodeResolve(),
      typescript({
        declaration: false,
        declarationMap: false,
        sourceMap: false,
        target: 'ES2015',
        module: 'ES2015',
        lib: ['ES2015', 'DOM'],
        compilerOptions: {
          outDir: null,
          rootDir: './src',
        },
      }),
    ],
  },
  // Browser bundle for example-files.js (createExampleFiles)
  {
    input: 'src/example-files.ts',
    output: {
      file: 'dist/browser/example-files.js',
      format: 'iife',
      name: 'ExampleFilesModule',
      extend: true,
      footer:
        'if (typeof window !== "undefined") { window.createExampleFiles = ExampleFilesModule.createExampleFiles || ExampleFilesModule.default; }',
    },
    plugins: [
      nodeResolve(),
      typescript({
        declaration: false,
        declarationMap: false,
        sourceMap: false,
        target: 'ES2015',
        module: 'ES2015',
        lib: ['ES2015', 'DOM'],
        compilerOptions: {
          outDir: null,
          rootDir: './src',
        },
      }),
    ],
  },
];
