/** Union-find con compresión de caminos y unión por rango, sobre claves string. */
export class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();

  add(key: string): void {
    if (!this.parent.has(key)) {
      this.parent.set(key, key);
      this.rank.set(key, 0);
    }
  }

  find(key: string): string {
    this.add(key);
    let root = key;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = key;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): string {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return ra;
    const rankA = this.rank.get(ra)!;
    const rankB = this.rank.get(rb)!;
    if (rankA < rankB) {
      this.parent.set(ra, rb);
      return rb;
    }
    if (rankA > rankB) {
      this.parent.set(rb, ra);
      return ra;
    }
    this.parent.set(rb, ra);
    this.rank.set(ra, rankA + 1);
    return ra;
  }

  same(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }

  keys(): IterableIterator<string> {
    return this.parent.keys();
  }

  clone(): UnionFind {
    const copy = new UnionFind();
    for (const [k, v] of this.parent) copy.parent.set(k, v);
    for (const [k, v] of this.rank) copy.rank.set(k, v);
    return copy;
  }
}
