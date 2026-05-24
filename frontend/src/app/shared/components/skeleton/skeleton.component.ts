import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Skeleton placeholder reutilizable.
 *
 * Uso:
 *   <app-skeleton variant="text" />          → línea de texto (h=14px)
 *   <app-skeleton variant="title" />         → título (h=24px)
 *   <app-skeleton variant="circle" size="40" />  → círculo (avatar)
 *   <app-skeleton variant="rect" width="100%" height="120" />  → bloque rectangular
 *   <app-skeleton variant="text" count="3" />  → 3 líneas de texto apiladas
 *
 * Todas las variantes usan la misma animación shimmer.
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    @for (i of items; track i) {
      <div
        class="skeleton"
        [class.text]="variant === 'text'"
        [class.title]="variant === 'title'"
        [class.circle]="variant === 'circle'"
        [class.rect]="variant === 'rect'"
        [style.width]="resolveWidth()"
        [style.height]="resolveHeight()"
        [style.border-radius]="variant === 'circle' ? '50%' : null"
      ></div>
    }
  `,
  styles: [`
    :host { display: block; }

    .skeleton {
      background: linear-gradient(
        90deg,
        #f1f5f9 0%,
        #e2e8f0 50%,
        #f1f5f9 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
      border-radius: 6px;
    }
    .skeleton + .skeleton { margin-top: 8px; }

    .skeleton.text { height: 14px; }
    .skeleton.title { height: 24px; width: 60%; }
    .skeleton.circle { display: inline-block; }
    .skeleton.rect { width: 100%; }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class SkeletonComponent {
  @Input() variant: 'text' | 'title' | 'circle' | 'rect' = 'text';
  @Input() width: string | number = '100%';
  @Input() height: string | number = '';
  /** Cantidad de skeletons apilados (útil para listas). */
  @Input() count = 1;
  /** Atajo para círculos (avatar): aplica como ancho Y altura. */
  @Input() size: string | number = 40;

  get items(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }

  resolveWidth(): string | null {
    if (this.variant === 'circle') return this.toCssSize(this.size);
    if (this.variant === 'title') return '60%';
    return this.toCssSize(this.width);
  }

  resolveHeight(): string | null {
    if (this.variant === 'circle') return this.toCssSize(this.size);
    if (this.variant === 'text') return '14px';
    if (this.variant === 'title') return '24px';
    return this.toCssSize(this.height || 80);
  }

  private toCssSize(v: string | number): string | null {
    if (typeof v === 'number') return `${v}px`;
    return v || null;
  }
}
