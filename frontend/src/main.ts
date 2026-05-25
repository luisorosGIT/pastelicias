import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initSentry } from './app/core/sentry';

// Sentry primero — captura errores de bootstrap también.
// initSentry es no-op si environment.sentryDsn está vacío.
initSentry().finally(() => {
  bootstrapApplication(AppComponent, appConfig).catch((err) =>
    console.error('Error al iniciar Genimatech:', err)
  );
});
