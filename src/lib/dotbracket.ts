/** Parse a dot-bracket structure string into structural elements */

export interface BasePair {
  i: number;
  j: number;
}

export interface StructureElement {
  type: 'stem' | 'hairpin' | 'internal_loop' | 'bulge' | 'multiloop' | 'dangling';
  positions: number[];
  size: number;
  /** For stems: number of consecutive base pairs */
  stemLength?: number;
  /** For loops: the enclosing pair indices */
  enclosedBy?: [number, number];
}

export interface ParsedStructure {
  dotbracket: string;
  length: number;
  pairs: BasePair[];
  numPairs: number;
  pctPaired: number;
  stems: StructureElement[];
  hairpins: StructureElement[];
  internalLoops: StructureElement[];
  bulges: StructureElement[];
  multiloops: StructureElement[];
  /** positions that are unpaired */
  unpaired: number[];
  /** DR region (0–35) pair count */
  drPairs: number;
  /** Guide region (36+) unpaired fraction */
  guideUnpairedFrac: number;
  /** Any base pairs between DR (0–35) and guide (36+) */
  crossPairs: BasePair[];
}

const DR_END = 35; // 0-indexed, inclusive

export function parseDotBracket(db: string): ParsedStructure {
  const n = db.length;

  // ── 1. Find all base pairs via stack ──────────────────────────────────────
  const stack: number[] = [];
  const pairs: BasePair[] = [];
  const partnerOf: number[] = new Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    if (db[i] === '(') {
      stack.push(i);
    } else if (db[i] === ')') {
      if (stack.length > 0) {
        const j = stack.pop()!;
        pairs.push({ i: j, j: i });
        partnerOf[j] = i;
        partnerOf[i] = j;
      }
    }
  }

  const unpaired = Array.from({ length: n }, (_, i) => i).filter(i => partnerOf[i] === -1);

  // ── 2. DR / guide metrics ─────────────────────────────────────────────────
  const drPairs = pairs.filter(p => p.i <= DR_END && p.j <= DR_END).length;
  const crossPairs = pairs.filter(p =>
    (p.i <= DR_END && p.j > DR_END) || (p.j <= DR_END && p.i > DR_END)
  );
  const guidePositions = Array.from({ length: n - (DR_END + 1) }, (_, k) => k + DR_END + 1);
  const guideUnpaired = guidePositions.filter(i => partnerOf[i] === -1).length;
  const guideUnpairedFrac = guidePositions.length > 0 ? guideUnpaired / guidePositions.length : 1;

  // ── 3. Identify stems (consecutive base pairs) ────────────────────────────
  // Sort pairs by i
  const sortedPairs = [...pairs].sort((a, b) => a.i - b.i);
  const usedPairIdx = new Set<number>();
  const stems: StructureElement[] = [];

  for (let pi = 0; pi < sortedPairs.length; pi++) {
    if (usedPairIdx.has(pi)) continue;
    const stemPairs: BasePair[] = [sortedPairs[pi]];
    usedPairIdx.add(pi);

    let ci = sortedPairs[pi].i;
    let cj = sortedPairs[pi].j;

    // Extend stem while consecutive pairs are nested
    for (let qi = pi + 1; qi < sortedPairs.length; qi++) {
      if (usedPairIdx.has(qi)) continue;
      const np = sortedPairs[qi];
      if (np.i === ci + 1 && np.j === cj - 1) {
        stemPairs.push(np);
        usedPairIdx.add(qi);
        ci = np.i;
        cj = np.j;
      } else {
        break;
      }
    }

    const allPos = stemPairs.flatMap(p => [p.i, p.j]);
    stems.push({
      type: 'stem',
      positions: allPos,
      size: stemPairs.length,
      stemLength: stemPairs.length,
    });
  }

  // ── 4. Identify loop types ────────────────────────────────────────────────
  const hairpins: StructureElement[] = [];
  const internalLoops: StructureElement[] = [];
  const bulges: StructureElement[] = [];
  const multiloops: StructureElement[] = [];

  for (const p of pairs) {
    const { i, j } = p;
    if (j - i < 2) continue;

    // Collect unpaired positions strictly between i and j
    const between: number[] = [];
    for (let k = i + 1; k < j; k++) {
      if (partnerOf[k] === -1) between.push(k);
    }

    // Collect nested pairs inside this pair
    const nested = pairs.filter(q => q.i > i && q.j < j && partnerOf[q.i] === q.j);
    // Only consider the outermost nested pairs (not pairs inside nested pairs)
    const outerNested = nested.filter(q =>
      !nested.some(r => r.i < q.i && r.j > q.j)
    );

    if (outerNested.length === 0) {
      // Hairpin loop: no nested pairs, all between positions are loop
      if (between.length >= 1) {
        hairpins.push({
          type: 'hairpin',
          positions: between,
          size: between.length,
          enclosedBy: [i, j],
        });
      }
    } else if (outerNested.length === 1) {
      const inner = outerNested[0];
      // Unpaired on 5' side (between i and inner.i)
      const left5 = between.filter(k => k < inner.i);
      // Unpaired on 3' side (between inner.j and j)
      const right3 = between.filter(k => k > inner.j);

      if (left5.length > 0 && right3.length > 0) {
        // Internal loop
        internalLoops.push({
          type: 'internal_loop',
          positions: [...left5, ...right3],
          size: left5.length + right3.length,
          enclosedBy: [i, j],
        });
      } else if (left5.length > 0 || right3.length > 0) {
        // Bulge
        bulges.push({
          type: 'bulge',
          positions: [...left5, ...right3],
          size: left5.length + right3.length,
          enclosedBy: [i, j],
        });
      }
    } else if (outerNested.length >= 2) {
      // Multiloop: multiple nested helices
      multiloops.push({
        type: 'multiloop',
        positions: between,
        size: between.length,
        enclosedBy: [i, j],
      });
    }
  }

  return {
    dotbracket: db,
    length: n,
    pairs,
    numPairs: pairs.length,
    pctPaired: pairs.length * 2 / n,
    stems,
    hairpins,
    internalLoops,
    bulges,
    multiloops,
    unpaired,
    drPairs,
    guideUnpairedFrac,
    crossPairs,
  };
}
