import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Build PDA: npm run build && npx cap sync android
 * Ver frontend/docs/PDA-CAPACITOR.md
 */
const config: CapacitorConfig = {
  appId: 'com.clinica.erp.pda',
  appName: 'Clinica ERP PDA',
  webDir: '.output/public',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
}

export default config
