import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe, CurrencyPipe } from '@angular/common';

export type KpiFormat = 'currency' | 'number' | 'percent' | 'integer';

/**
 * KPI Card — estilo "Enterprise":
 *  - Label en mayúsculas pequeño arriba
 *  - Valor grande y bold abajo
 *  - Icono cuadrado tintado en esquina superior derecha
 *  - Subtitle/trend opcional debajo del valor
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [MatIconModule, DecimalPipe, CurrencyPipe],
  template: `
    <div class="kpi-card group">
      <div class="kpi-bg-icon">
        <mat-icon [style.color]="accentColor">{{ icon }}</mat-icon>
      </div>
      <div class="kpi-top">
        <div class="kpi-icon-container" [style.background]="accentColor + '15'" [style.color]="accentColor">
          <mat-icon>{{ icon }}</mat-icon>
        </div>
        @if (trend !== undefined) {
          <span class="kpi-trend" [class.up]="trend >= 0" [class.down]="trend < 0">
            {{ trend >= 0 ? '+' : '' }}{{ trend | number:'1.1-1' }}%
          </span>
        } @else if (subtitle) {
          <span class="kpi-subtitle-badge" [style.background]="accentColor + '15'" [style.color]="accentColor">
            {{ subtitle }}
          </span>
        }
      </div>

      <div class="kpi-content">
        <p class="kpi-label">{{ label }}</p>
        <h3 class="kpi-value">
          @switch (format) {
            @case ('currency') { {{ value | currency:'S/ ':'symbol':'1.2-2' }} }
            @case ('percent')  { {{ value | number:'1.1-1' }}% }
            @case ('integer')  { {{ value | number:'1.0-0' }} }
            @default { {{ value | number:'1.2-2' }} }
          }
        </h3>
      </div>
    </div>
  `,
  styles: [`
    .kpi-card {
      background: var(--color-surface);
      border-radius: var(--radius-xl);
      padding: var(--space-4);
      box-shadow: var(--shadow-2);
      border: none;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .kpi-card:hover {
      box-shadow: var(--shadow-md);
    }

    .kpi-bg-icon {
      position: absolute;
      top: 0;
      right: 0;
      padding: 16px;
      opacity: 0.1;
      transition: opacity 0.2s;
      z-index: 0;
    }
    .kpi-card:hover .kpi-bg-icon {
      opacity: 0.2;
    }
    .kpi-bg-icon mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
    }

    .kpi-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      z-index: 1;
    }
    
    .kpi-icon-container {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .kpi-icon-container mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      font-variation-settings: 'FILL' 0;
    }

    .kpi-content {
      display: flex;
      flex-direction: column;
      z-index: 1;
    }
    
    .kpi-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 4px 0;
    }
    
    .kpi-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--color-on-surface);
      margin: 0;
      letter-spacing: -0.01em;
    }

    .kpi-trend {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
    }
    .kpi-trend.up   { background: var(--color-surface-container-highest); color: var(--color-primary); }
    .kpi-trend.down { background: var(--color-error-container);  color: var(--color-on-error-container); }
    
    .kpi-subtitle-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
    }
  `],
})
export class KpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number;
  @Input({ required: true }) icon!: string;
  @Input() format: KpiFormat = 'currency';
  @Input() accentColor = '#4648d4';
  @Input() subtitle?: string;
  @Input() trend?: number;
}
