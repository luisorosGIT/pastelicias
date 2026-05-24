import { Component, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { BranchService } from '../../../core/services/branch.service';

@Component({
  selector: 'app-branch-selector',
  standalone: true,
  imports: [CommonModule, MatMenuModule, MatIconModule],
  template: `
    <div class="branch-selector" [matMenuTriggerFor]="branchMenu">
      <mat-icon>storefront</mat-icon>
      <span class="selected-text">{{ selectedBranchName() }}</span>
      <mat-icon class="chevron">expand_more</mat-icon>
    </div>

    <mat-menu #branchMenu="matMenu" class="custom-branch-menu" xPosition="before">
      <button mat-menu-item (click)="onBranchChange('')" [class.active-branch]="!branchService.selectedBranchId()">
        <mat-icon>domain</mat-icon>
        <span>Todas las sucursales</span>
      </button>
      @for (branch of branchService.branches(); track branch.id) {
        <button mat-menu-item (click)="onBranchChange(branch.id)" [class.active-branch]="branchService.selectedBranchId() === branch.id">
          <mat-icon>store</mat-icon>
          <span>{{ branch.name }}</span>
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    .branch-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--color-surface);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-sm);
      padding: 6px 12px;
      height: 40px;
      box-sizing: border-box;
      transition: all 0.2s;
      cursor: pointer;
      user-select: none;
    }
    .branch-selector:hover {
      background: var(--color-surface-container-low);
      border-color: var(--color-primary);
      box-shadow: var(--shadow-sm);
    }
    .branch-selector mat-icon {
      color: var(--color-primary);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .branch-selector .chevron {
      color: var(--color-on-surface-variant);
      margin-left: 4px;
    }
    .selected-text {
      color: var(--color-on-surface);
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
    }
    
    ::ng-deep .custom-branch-menu {
      border-radius: var(--radius-lg) !important;
      padding: 8px !important;
      min-width: 220px !important;
      box-shadow: var(--shadow-2) !important;
      background: var(--color-surface) !important;
    }
    ::ng-deep .custom-branch-menu .mat-mdc-menu-item {
      border-radius: var(--radius-sm) !important;
      margin-bottom: 2px;
      font-size: 14px !important;
      font-weight: 500 !important;
      font-family: 'Plus Jakarta Sans', sans-serif !important;
      color: var(--color-on-surface) !important;
    }
    ::ng-deep .custom-branch-menu .mat-mdc-menu-item:hover {
      background: var(--color-surface-container-high) !important;
    }
    ::ng-deep .custom-branch-menu .mat-mdc-menu-item.active-branch {
      background: var(--color-primary-fixed) !important;
      color: var(--color-primary) !important;
      font-weight: 700 !important;
    }
    ::ng-deep .custom-branch-menu .mat-mdc-menu-item.active-branch mat-icon {
      color: var(--color-primary) !important;
    }
  `],
})
export class BranchSelectorComponent implements OnInit {
  selectedBranchName = computed(() => {
    const id = this.branchService.selectedBranchId();
    if (!id) return 'Todas las sucursales';
    const branch = this.branchService.branches().find(b => b.id === id);
    return branch ? branch.name : 'Todas las sucursales';
  });

  constructor(public branchService: BranchService) {}

  async ngOnInit(): Promise<void> {
    await this.branchService.loadBranches();
  }

  onBranchChange(branchId: string): void {
    if (branchId) {
      this.branchService.selectBranch(branchId);
    } else {
      this.branchService.selectAllBranches();
    }
  }
}
