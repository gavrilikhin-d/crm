import { definePreview } from "@storybook/nextjs-vite";
import MockDate from "mockdate";
import { initialize, mswLoader } from "msw-storybook-addon";
import { ThemeProvider } from "next-themes";
import { Providers } from "../src/app/providers";
import { Toaster } from "../src/components/ui/sonner";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { I18nProvider } from "../src/i18n/context";
import { mswHandlers } from "./msw-handlers";
import "../src/app/globals.css";

initialize({ onUnhandledRequest: "bypass" });

const preview = definePreview({
  addons: [],
  decorators: [
    (Story) => (
      <I18nProvider>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <TooltipProvider>
              <Story />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </Providers>
      </I18nProvider>
    )
  ],
  loaders: [mswLoader],
  parameters: {
    nextjs: {
      appDirectory: true
    },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo"
    },

    chromatic: {
      pauseAnimationAtEnd: true
    },

    msw: {
      handlers: mswHandlers
    }
  },
  beforeEach() {
    MockDate.set("2024-04-01T12:00:00.000Z");
    return () => MockDate.reset();
  }
});

export default preview;