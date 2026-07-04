import type { StorybookConfig } from '@storybook/nextjs-vite';

import { dirname } from "path"

import { fileURLToPath } from "url"

/**
* This function is used to resolve the absolute path of a package.
* It is needed in projects that use Yarn PnP or are set up within a monorepo.
*/
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}
const config: StorybookConfig = {
  "stories": ["../src/**/*.stories.tsx"],
  "addons": [
    getAbsolutePath('@chromatic-com/storybook'),
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-mcp')
  ],
  "framework": getAbsolutePath('@storybook/nextjs-vite'),
  "staticDirs": [
    "../public"
  ],
  viteFinal: async (config) => {
    config.define = {
      ...config.define,
      "process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME": JSON.stringify(
        process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "storybook_vocal_bot"
      )
    };

    return config;
  }
};
export default config;