import { MeasureUnit } from '../models';

/**
 * Tabla de factores de conversión entre unidades compatibles.
 * - Peso:    KG ↔ G (1 kg = 1000 g)
 * - Volumen: L  ↔ ML (1 L  = 1000 ml)
 * - Conteo:  UNIT solo se convierte a sí misma
 *
 * convert(qty, from, to) = qty * CONVERSION[from][to]
 *
 * NaN significa "no convertible" (categorías distintas, ej. kg → ml).
 */
const CONVERSION: Record<MeasureUnit, Record<MeasureUnit, number>> = {
  KG:   { KG: 1,     G: 1000,  L: NaN,    ML: NaN, UNIT: NaN },
  G:    { KG: 0.001, G: 1,     L: NaN,    ML: NaN, UNIT: NaN },
  L:    { KG: NaN,   G: NaN,   L: 1,      ML: 1000, UNIT: NaN },
  ML:   { KG: NaN,   G: NaN,   L: 0.001,  ML: 1,    UNIT: NaN },
  UNIT: { KG: NaN,   G: NaN,   L: NaN,    ML: NaN,  UNIT: 1 },
};

export const UNIT_SHORT: Record<MeasureUnit, string> = {
  KG: 'kg', G: 'g', L: 'l', ML: 'ml', UNIT: 'u',
};

export const UNIT_LONG: Record<MeasureUnit, string> = {
  KG: 'Kilogramos',
  G: 'Gramos',
  L: 'Litros',
  ML: 'Mililitros',
  UNIT: 'Unidades',
};

/**
 * Devuelve las unidades que pueden usarse para expresar una cantidad cuando
 * el insumo tiene `base` como unidad base.
 *
 *   compatibleUnits('G')  → ['KG', 'G']
 *   compatibleUnits('ML') → ['L', 'ML']
 *   compatibleUnits('UNIT') → ['UNIT']
 */
export function compatibleUnits(base: MeasureUnit): MeasureUnit[] {
  switch (base) {
    case 'KG':
    case 'G':
      return ['KG', 'G'];
    case 'L':
    case 'ML':
      return ['L', 'ML'];
    case 'UNIT':
      return ['UNIT'];
  }
}

/**
 * Convierte una cantidad entre unidades compatibles.
 *   convert(800, 'G',  'KG') → 0.8
 *   convert(1.5, 'KG', 'G')  → 1500
 * Lanza error si las unidades no son compatibles.
 */
export function convert(quantity: number, from: MeasureUnit, to: MeasureUnit): number {
  const factor = CONVERSION[from][to];
  if (isNaN(factor)) {
    throw new Error(`No se puede convertir de ${from} a ${to} (categorías distintas)`);
  }
  return quantity * factor;
}

/**
 * Sugiere una unidad "amigable" para mostrar un valor.
 *   Ej. 1500 con base G  → KG (porque 1.5 kg se lee mejor que 1500 g)
 *       300  con base G  → G  (300 g está bien)
 *       2    con base ML → ML (2 ml no necesita conversión)
 */
export function bestDisplayUnit(quantityBase: number, base: MeasureUnit): MeasureUnit {
  if (base === 'G' && quantityBase >= 1000) return 'KG';
  if (base === 'ML' && quantityBase >= 1000) return 'L';
  return base;
}

/**
 * Descompone una cantidad de stock en "unidad mayor + resto en unidad menor".
 * Pensado para mostrar al usuario el stock real de forma natural:
 *
 *   39500 g  → "39 kg y 500 g"
 *   8000  g  → "8 kg"
 *   500   g  → "500 g"
 *   1500  ml → "1 L y 500 ml"
 *   12    UNIT → "12 u"
 *
 * - Para peso (KG/G) usa el par KG/G (1000 g = 1 kg).
 * - Para volumen (L/ML) usa el par L/ML.
 * - Para UNIT muestra solo el número entero.
 */
export function formatStockBreakdown(stockBase: number, baseUnit: MeasureUnit): string {
  if (stockBase < 0) stockBase = 0;

  if (baseUnit === 'UNIT') {
    return `${roundDisplay(stockBase)} u`;
  }

  const isWeight = baseUnit === 'KG' || baseUnit === 'G';
  const majorUnit: MeasureUnit = isWeight ? 'KG' : 'L';
  const minorUnit: MeasureUnit = isWeight ? 'G' : 'ML';

  // Pasamos todo a la unidad menor (G o ML) para hacer la división limpia.
  const totalInMinor = convert(stockBase, baseUnit, minorUnit);

  const majorInteger = Math.floor(totalInMinor / 1000);
  const remainderInMinor = Math.round((totalInMinor - majorInteger * 1000) * 100) / 100;

  const majorShort = UNIT_SHORT[majorUnit];
  const minorShort = UNIT_SHORT[minorUnit];

  if (majorInteger > 0 && remainderInMinor > 0) {
    return `${majorInteger} ${majorShort} y ${roundDisplay(remainderInMinor)} ${minorShort}`;
  }
  if (majorInteger > 0) {
    return `${majorInteger} ${majorShort}`;
  }
  return `${roundDisplay(remainderInMinor)} ${minorShort}`;
}

function roundDisplay(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // máx 2 decimales, sin ceros a la derecha
  return String(Math.round(n * 100) / 100);
}

// ─── Unidades de cocina (solo para volumen — L/ML) ───────────────────────────
// Estandarizadas según las medidas más comunes en repostería peruana/
// internacional. Cada una tiene un valor exacto en mililitros.
// Estas NO van a la base de datos: el sistema sigue guardando todo en la
// unidad base del insumo (ML o L). Solo son alias amigables en el BOM.
export const COOKING_UNITS = {
  // Cucharaditas (té / café)
  CUCHARADITA_QUARTER: { ml: 1.25, label: '1/4 cucharadita' },
  CUCHARADITA_HALF:    { ml: 2.5,  label: '1/2 cucharadita' },
  CUCHARADITA:         { ml: 5,    label: '1 cucharadita' },
  // Cucharadas (soperas)
  CUCHARADA_QUARTER:        { ml: 3.75,  label: '1/4 cucharada' },
  CUCHARADA_HALF:           { ml: 7.5,   label: '1/2 cucharada' },
  CUCHARADA_THREE_QUARTERS: { ml: 11.25, label: '3/4 cucharada' },
  CUCHARADA:                { ml: 15,    label: '1 cucharada' },
  // Tazas (estándar US — 240 ml)
  TAZA_QUARTER:        { ml: 60,  label: '1/4 taza' },
  TAZA_THIRD:          { ml: 80,  label: '1/3 taza' },
  TAZA_HALF:           { ml: 120, label: '1/2 taza' },
  TAZA_TWO_THIRDS:     { ml: 160, label: '2/3 taza' },
  TAZA_THREE_QUARTERS: { ml: 180, label: '3/4 taza' },
  TAZA:                { ml: 240, label: '1 taza' },
  // Otros
  VASO:        { ml: 200, label: '1 vaso (200 ml)' },
  ONZA_FLUIDA: { ml: 30,  label: '1 onza líquida (30 ml)' },
} as const;

export type CookingUnit = keyof typeof COOKING_UNITS;

/** Tipo que combina las unidades reales del sistema + las "amigables" de cocina. */
export type BomUnit = MeasureUnit | CookingUnit;

/** Type guard para distinguir entre unidad real y de cocina. */
export function isCookingUnit(u: string): u is CookingUnit {
  return u in COOKING_UNITS;
}

/**
 * Unidades disponibles en el selector del BOM según la unidad base del insumo.
 * - Líquidos (L/ML): cucharadas/tazas exactas
 * - Sólidos (KG/G): mismas cucharadas/tazas pero con conversión aproximada
 *   asumiendo densidad = 1 g/ml (densidad del agua). Útil para azúcar, sal,
 *   esencias, etc. Para precisión real en harina/cacao usar gramos con balanza.
 * - UNIT: no aplica (es discreto)
 */
export function bomUnitsFor(base: MeasureUnit): BomUnit[] {
  const real = compatibleUnits(base);
  if (base === 'UNIT') return real;
  return [
    ...real,
    'CUCHARADITA_QUARTER', 'CUCHARADITA_HALF', 'CUCHARADITA',
    'CUCHARADA_QUARTER', 'CUCHARADA_HALF', 'CUCHARADA_THREE_QUARTERS', 'CUCHARADA',
    'TAZA_QUARTER', 'TAZA_THIRD', 'TAZA_HALF', 'TAZA_TWO_THIRDS', 'TAZA_THREE_QUARTERS', 'TAZA',
    'VASO', 'ONZA_FLUIDA',
  ];
}

/**
 * Convierte una cantidad en cualquier BomUnit (real o de cocina) a la unidad
 * BASE del insumo.
 *
 *  Líquidos (L/ML): conversión exacta (1 cda = 15 ml).
 *  Sólidos (KG/G):  asume 1 ml ≈ 1 g (densidad del agua). Es una aproximación
 *                   estándar de cocina. Para azúcar/sal funciona bien; para
 *                   harina/cacao subestima. Usar gramos directos si necesitas
 *                   precisión real.
 */
export function convertToBase(
  qty: number,
  fromUnit: BomUnit,
  ingredientBaseUnit: MeasureUnit
): number {
  if (isCookingUnit(fromUnit)) {
    if (ingredientBaseUnit === 'UNIT') {
      throw new Error(`Unidad de cocina ${fromUnit} no es válida para insumos discretos`);
    }
    const totalMl = qty * COOKING_UNITS[fromUnit].ml;
    switch (ingredientBaseUnit) {
      case 'ML': return totalMl;
      case 'L':  return totalMl / 1000;
      // Sólidos: aproximación 1 ml ≈ 1 g (densidad del agua)
      case 'G':  return totalMl;
      case 'KG': return totalMl / 1000;
    }
  }
  return convert(qty, fromUnit, ingredientBaseUnit);
}

/** True si la conversión de esta unidad para esta base es APROXIMADA (no exacta). */
export function isApproximate(fromUnit: BomUnit, ingredientBaseUnit: MeasureUnit): boolean {
  return isCookingUnit(fromUnit) && (ingredientBaseUnit === 'G' || ingredientBaseUnit === 'KG');
}

/**
 * Label legible para el dropdown — incluye el equivalente en ml y gramos para
 * cooking units. Usamos la aproximación 1 ml ≈ 1 g (densidad del agua), que
 * es la misma que el sistema usa internamente al convertir a la base.
 *
 * Ej: "1/4 taza (60 ml · 60 g)"
 *     "1 cucharada (15 ml · 15 g)"
 */
export function bomUnitLabel(u: BomUnit): string {
  if (isCookingUnit(u)) {
    const ml = COOKING_UNITS[u].ml;
    return `${COOKING_UNITS[u].label} (${ml} ml · ${ml} g)`;
  }
  return `${UNIT_LONG[u]} (${UNIT_SHORT[u]})`;
}

/** Label corto para hints — "1 cda" o "kg" según el tipo. */
export function bomUnitShort(u: BomUnit): string {
  if (isCookingUnit(u)) return COOKING_UNITS[u].label;
  return UNIT_SHORT[u];
}
