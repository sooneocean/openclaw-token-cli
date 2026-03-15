import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/sdk.ts', 'bin/openclaw-token.ts'],
  format: ['esm'],
  target: 'node18',
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
