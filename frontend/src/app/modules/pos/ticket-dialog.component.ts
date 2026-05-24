import { Component, Inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Business, Sale } from '../../core/models';

export interface TicketDialogData {
  sale: Sale & {
    items: { recipe?: { name: string }; quantity: number; unitPrice: number }[];
  };
  business: Pick<Business, 'name' | 'ruc' | 'taxRate'>;
}

@Component({
  selector: 'app-ticket-dialog',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="ticket-dialog">
      <div class="dialog-header no-print">
        <h2><mat-icon>receipt</mat-icon> Venta registrada</h2>
        <p class="muted">Imprime o cierra para continuar.</p>
      </div>

      <!-- ─── Ticket imprimible ───────────────────────────────────────── -->
      <div class="ticket-print">
        <div class="ticket-head">
          <h3>{{ data.business.name }}</h3>
          @if (data.business.ruc) {
            <p>RUC: {{ data.business.ruc }}</p>
          }
          <p>Boleta de Venta Electrónica</p>
          <p class="code">Código: {{ data.sale.ticketCode }}</p>
          <p>{{ data.sale.createdAt | date:'dd/MM/yyyy HH:mm' }}</p>
        </div>

        <div class="divider"></div>

        <table class="ticket-items">
          <thead>
            <tr>
              <th class="left">Producto</th>
              <th class="center">Cant.</th>
              <th class="right">Precio</th>
            </tr>
          </thead>
          <tbody>
            @for (it of data.sale.items; track $index) {
              <tr>
                <td class="left">{{ it.recipe?.name ?? '—' }}</td>
                <td class="center">{{ it.quantity }}</td>
                <td class="right">{{ (it.unitPrice * it.quantity) | currency:'S/ ':'symbol':'1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="ticket-totals">
          <div class="row"><span>Subtotal</span><strong>{{ data.sale.subtotal | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
          <div class="row"><span>IGV ({{ data.business.taxRate }}%)</span><strong>{{ data.sale.taxAmount | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
          <div class="row total"><span>TOTAL</span><strong>{{ data.sale.total | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>

          @if (data.sale.amountReceived != null) {
            <div class="row"><span>Recibido</span><strong>{{ data.sale.amountReceived | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
            <div class="row"><span>Vuelto</span><strong>{{ data.sale.change | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
          }
        </div>

        <div class="divider"></div>

        <p class="thanks">¡Gracias por su compra!</p>
      </div>

      <!-- ─── Acciones (no se imprimen) ──────────────────────────────── -->
      <div class="actions no-print">
        <button mat-stroked-button (click)="dialogRef.close()">Cerrar</button>
        <button mat-flat-button color="primary" (click)="print()">
          <mat-icon>print</mat-icon> Imprimir Ticket
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ticket-dialog {
      padding: 0;
      min-width: 360px;
      max-width: 420px;
    }
    .dialog-header { padding: 20px 24px 8px 24px; }
    .dialog-header h2 {
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 700;
      color: #1E293B;
    }
    .dialog-header h2 mat-icon { color: #6366F1; }
    .muted { color: #64748B; font-size: 13px; margin: 0; }

    .ticket-print {
      font-family: 'Courier New', Courier, monospace;
      padding: 16px 24px;
      background: #fff;
      color: #000;
    }
    .ticket-head { text-align: center; }
    .ticket-head h3 { margin: 0 0 4px 0; font-size: 15px; font-weight: 700; }
    .ticket-head p { margin: 2px 0; font-size: 12px; }
    .ticket-head .code { font-size: 11px; word-break: break-all; }

    .divider {
      border-top: 1px dashed #000;
      margin: 10px 0;
    }

    .ticket-items {
      width: 100%;
      font-size: 12px;
      border-collapse: collapse;
    }
    .ticket-items th { font-weight: 600; padding: 4px 0; }
    .ticket-items td { padding: 3px 0; }
    .left { text-align: left; }
    .center { text-align: center; }
    .right { text-align: right; }

    .ticket-totals { font-size: 12px; }
    .ticket-totals .row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .ticket-totals .row.total {
      font-size: 14px;
      font-weight: 700;
      padding-top: 6px;
      margin-top: 4px;
      border-top: 1px solid #000;
    }
    .thanks { text-align: center; font-size: 12px; margin: 12px 0 4px 0; }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 24px 20px 24px;
      border-top: 1px solid #F1F5F9;
    }

    /* Las reglas de impresión están en styles.scss (global) — usan la técnica
       visibility:hidden + visible para que se imprima solo .ticket-print
       sin sombras ni bordes del MatDialog. */
  `],
})
export class TicketDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<TicketDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TicketDialogData
  ) {}

  print(): void {
    window.print();
  }
}
