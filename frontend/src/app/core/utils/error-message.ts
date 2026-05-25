/**
 * Extrae un mensaje útil de cualquier error que llegue al .catch() de una
 * llamada HTTP (o de cualquier otra fuente).
 *
 * El problema: los errores de Angular HttpClient son `HttpErrorResponse`, NO
 * instancias de `Error`. El patrón viejo `e instanceof Error ? e.message :
 * 'Error'` siempre cae al fallback "Error" y oculta el mensaje real del
 * backend (ej. "Has alcanzado el límite de tu plan Gratis...").
 *
 * Esta función entiende:
 *  - HttpErrorResponse con body `{ error: "..." }` o `{ message: "..." }`
 *  - HttpErrorResponse con body string
 *  - Error estándar
 *  - Cualquier otra cosa → fallback
 */
export function getErrorMessage(err: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.'): string {
  if (!err) return fallback;

  // HttpErrorResponse de Angular: tiene una propiedad `error` con el body parseado
  if (typeof err === 'object' && err !== null && 'error' in err) {
    const httpErr = err as { error?: unknown; message?: string; status?: number };

    // Body es objeto JSON con { error: "..." } o { message: "..." }
    if (httpErr.error && typeof httpErr.error === 'object') {
      const body = httpErr.error as { error?: string; message?: string };
      if (typeof body.error === 'string' && body.error) return body.error;
      if (typeof body.message === 'string' && body.message) return body.message;
    }

    // Body es string plano (algunos backends devuelven texto)
    if (typeof httpErr.error === 'string' && httpErr.error) return httpErr.error;

    // Algún message en el wrapper de Angular ("Http failure response for...")
    if (httpErr.message) return httpErr.message;
  }

  // Error nativo
  if (err instanceof Error) return err.message;

  // String suelto
  if (typeof err === 'string') return err;

  return fallback;
}
