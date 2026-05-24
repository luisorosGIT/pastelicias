import { DateFilter } from '../types';

/**
 * Devuelve el rango de fechas [desde, hasta] para un filtro dado.
 */
export function getDateRange(filter: DateFilter): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return { from: today, to: new Date(today.getTime() + 86_400_000) };

    case 'yesterday': {
      const yesterday = new Date(today.getTime() - 86_400_000);
      return { from: yesterday, to: today };
    }

    case 'week': {
      const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun...
      const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 86_400_000);
      return { from: monday, to: new Date(today.getTime() + 86_400_000) };
    }

    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from: firstDay, to: lastDay };
    }

    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), q * 3, 1);
      const lastDay = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
      return { from: firstDay, to: lastDay };
    }

    case 'year': {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { from: firstDay, to: lastDay };
    }
  }
}
