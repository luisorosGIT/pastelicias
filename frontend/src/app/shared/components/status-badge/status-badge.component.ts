import { Component, Input } from '@angular/core';
import { ReservationStatus } from '../../../core/models';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_CONFIG: Record<ReservationStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:    { label: 'Pendiente',   variant: 'neutral' },
  CONFIRMED:  { label: 'Confirmada',  variant: 'info' },
  IN_PROCESS: { label: 'En Proceso',  variant: 'warning' },
  READY:      { label: 'Lista',       variant: 'success' },
  DELIVERED:  { label: 'Entregada',   variant: 'neutral' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="badge" [class]="'badge--' + variant">{{ displayLabel }}</span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge--success  { background: #D1FAE5; color: #065F46; }
    .badge--warning  { background: #FEF3C7; color: #92400E; }
    .badge--danger   { background: #FEE2E2; color: #991B1B; }
    .badge--info     { background: #DBEAFE; color: #1E40AF; }
    .badge--neutral  { background: #F1F5F9; color: #475569; }
  `],
})
export class StatusBadgeComponent {
  @Input() status?: ReservationStatus;
  @Input() label?: string;
  @Input() variant?: BadgeVariant;

  get displayLabel(): string {
    if (this.label) return this.label;
    return this.status ? STATUS_CONFIG[this.status].label : '';
  }

  get resolvedVariant(): BadgeVariant {
    if (this.variant) return this.variant;
    return this.status ? STATUS_CONFIG[this.status].variant : 'neutral';
  }
}
