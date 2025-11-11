import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ThemeConfig {
  palette: string;  // Palette name from palettes.json
  font: string;     // Font stack name from fonts.json
}

/**
 * Generate CSS with custom palette and font
 */
export function generateThemeCSS(config: ThemeConfig): string {
  // Load base CSS
  const baseCssPath = path.join(__dirname, '../../src/themes/base.css');
  let css = fs.readFileSync(baseCssPath, 'utf-8');

  // Load palettes
  const palettesPath = path.join(__dirname, '../../src/themes/palettes.json');
  const palettes = JSON.parse(fs.readFileSync(palettesPath, 'utf-8'));

  // Load fonts
  const fontsPath = path.join(__dirname, '../../src/themes/fonts.json');
  const fonts = JSON.parse(fs.readFileSync(fontsPath, 'utf-8'));

  // Get selected palette and font
  const palette = palettes[config.palette] || palettes.light;
  const font = fonts[config.font] || fonts.system;

  // Build custom CSS variables
  const customVars = `
/* Theme: ${palette.name} / ${font.name} */

:root {
  /* Color Palette: ${palette.name} */
  --color-bg: ${palette.colors.bg};
  --color-surface: ${palette.colors.surface};
  --color-text: ${palette.colors.text};
  --color-text-secondary: ${palette.colors['text-secondary']};
  --color-primary: ${palette.colors.primary};
  --color-primary-hover: ${palette.colors['primary-hover']};
  --color-border: ${palette.colors.border};
  --color-hover-bg: ${palette.colors['hover-bg']};

  /* Typography: ${font.name} */
  --font-body: ${font.body};
  --font-heading: ${font.heading};
  --font-mono: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
`;

  // Replace the :root block in base CSS with custom vars
  css = css.replace(
    /:root\s*\{[^}]*\}/s,
    customVars + '\n  /* Keep other variables from base */\n  --spacing-xs: 0.25rem;\n  --spacing-sm: 0.5rem;\n  --spacing-md: 1rem;\n  --spacing-lg: 1.5rem;\n  --spacing-xl: 2rem;\n  --spacing-2xl: 3rem;\n  --max-width: 1200px;\n  --content-width: 800px;\n  --sidebar-width: 300px;\n  --font-size-sm: 0.875rem;\n  --font-size-base: 1rem;\n  --font-size-lg: 1.125rem;\n  --font-size-xl: 1.25rem;\n  --font-size-2xl: 1.5rem;\n  --font-size-3xl: 1.875rem;\n  --font-size-4xl: 2.25rem;\n  --line-height-tight: 1.25;\n  --line-height-base: 1.6;\n  --line-height-relaxed: 1.8;\n  --radius-sm: 0.25rem;\n  --radius-md: 0.5rem;\n  --radius-lg: 1rem;\n  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);\n  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);\n  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);\n}'
  );

  return css;
}

/**
 * Get available palettes
 */
export function getAvailablePalettes(): string[] {
  const palettesPath = path.join(__dirname, '../../src/themes/palettes.json');
  const palettes = JSON.parse(fs.readFileSync(palettesPath, 'utf-8'));
  return Object.keys(palettes);
}

/**
 * Get available fonts
 */
export function getAvailableFonts(): string[] {
  const fontsPath = path.join(__dirname, '../../src/themes/fonts.json');
  const fonts = JSON.parse(fs.readFileSync(fontsPath, 'utf-8'));
  return Object.keys(fonts);
}
