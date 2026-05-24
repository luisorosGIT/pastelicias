import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  ngOnInit(): void {
    // ──────────────────────────────────────────────────────────────────────
    // UX global: cuando el usuario hace foco en un input numérico, seleccionar
    // todo el contenido. Así, si el campo tiene un 0 o un valor ficticio, basta
    // con escribir el nuevo número — no hay que borrar primero.
    //
    // Se hace con un listener global (capture phase) para cubrir TODOS los
    // inputs del proyecto, incluyendo los Material que se renderizan dentro
    // de dialogs y otros componentes dinámicos. Una sola línea de código,
    // aplica a toda la app.
    // ──────────────────────────────────────────────────────────────────────
    document.addEventListener(
      'focusin',
      (event: FocusEvent) => {
        const target = event.target as HTMLElement | null;
        if (!(target instanceof HTMLInputElement)) return;
        // Solo para inputs numéricos. No tocamos los de texto (donde un usuario
        // típicamente quiere posicionar el cursor, no reemplazar todo).
        if (target.type !== 'number') return;
        // setTimeout(0) garantiza que el select() ocurra DESPUÉS del manejo
        // default del foco — si no, algunos navegadores pierden la selección.
        setTimeout(() => {
          try {
            target.select();
          } catch {
            // Algunos tipos de input rechazan select(); ignorar silenciosamente.
          }
        }, 0);
      },
      true // captura: corre antes que los handlers de los hijos
    );
  }
}
