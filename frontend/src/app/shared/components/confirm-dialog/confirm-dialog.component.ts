import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="header" [class.danger]="data.danger">
        <mat-icon>{{ data.danger ? 'warning' : 'help_outline' }}</mat-icon>
        <h2>{{ data.title }}</h2>
      </div>
      <p class="message">{{ data.message }}</p>
      <div class="actions">
        <button mat-stroked-button (click)="dialogRef.close(false)">
          {{ data.cancelText ?? 'Cancelar' }}
        </button>
        <button
          mat-flat-button
          [color]="data.danger ? 'warn' : 'primary'"
          (click)="dialogRef.close(true)"
        >
          {{ data.confirmText ?? 'Confirmar' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog { padding: 24px; min-width: 360px; max-width: 540px; }
    .header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .header h2 { margin: 0; font-size: 18px; font-weight: 700; color: #1E293B; }
    .header mat-icon { color: #6366F1; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .header.danger mat-icon { color: #DC2626; }
    /* white-space: pre-line preserva los saltos de línea (\n) del mensaje. */
    .message { color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; white-space: pre-line; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
  `],
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}
}
