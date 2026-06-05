# PDA con Capacitor (Fase 2)

Las rutas `/pda/*` ya usan layout 360px y escáner por teclado. Para empaquetar en Android:

## Requisitos

- Node 20+
- Android Studio (SDK + emulador o dispositivo USB)
- JDK 17

## Instalación (una vez)

```powershell
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Clinica ERP PDA" com.clinica.erp.pda --web-dir .output/public
npx cap add android
```

El archivo `capacitor.config.ts` ya apunta a `.output/public` tras `nuxt build`.

## Build y sync

```powershell
npm run build
npx cap sync android
npx cap open android
```

En Android Studio: Run en el dispositivo. La app carga la UI estática; en producción configure `server.url` en `capacitor.config.ts` hacia su frontend HTTPS o embeba la API en la misma red.

## Desarrollo en red local

```ts
server: {
  url: 'http://192.168.1.10:3051',
  cleartext: true,
}
```

Use la IP de su PC (no `localhost`) desde el PDA.

## Escáner

Los lectores HID envían el código como teclado + Enter; `useBarcodeScanner` en las páginas PDA ya escucha ese flujo.
