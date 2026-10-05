import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'ZuriHorario · Tu tiempo, a tu ritmo', short_name: 'ZuriHorario',
      description: 'Tus turnos, tus horas y tu objetivo mensual, en un solo lugar.',
      theme_color: '#a44e6e', background_color: '#faf7f5',
      display: 'standalone', start_url: '.', scope: '.', lang: 'es',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'], navigateFallbackDenylist: [/^\/__/] }
  })]
});
