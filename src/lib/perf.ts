type PerfPoint = { label: string; ms: number };
type PerfSection = { name: string; start: number; points: PerfPoint[] };

export interface PerfTimer {
  section(name: string): void;
  point(label: string): void;
  end(): void;
}

const noop: PerfTimer = { section: () => {}, point: () => {}, end: () => {} };

export function createPerfTimer(label: string): PerfTimer {
  const enabled = process.env.NODE_ENV === 'development';
  if (!enabled) return noop;

  const sections: PerfSection[] = [];
  let currentSection: PerfSection | null = null;
  let pointStart = 0;
  const overallStart = performance.now();

  const api: PerfTimer = {
    section(name: string) {
      if (currentSection) sections.push(currentSection);
      currentSection = { name, start: performance.now(), points: [] };
      pointStart = currentSection.start;
    },
    point(label: string) {
      if (!currentSection) return;
      const now = performance.now();
      currentSection.points.push({ label, ms: now - pointStart });
      pointStart = now;
    },
    end() {
      if (currentSection) sections.push(currentSection);
      const total = performance.now() - overallStart;

      console.log(`\n===========================`);
      console.log(`  ${label}`);
      console.log(`===========================`);
      for (const s of sections) {
        if (s.points.length === 0) continue;
        let sectionTotal = 0;
        console.log(`\n${s.name}`);
        for (const p of s.points) {
          sectionTotal += p.ms;
          console.log(`  ${p.label} ${p.ms.toFixed(1)}ms`);
        }
        console.log(`  section total: ${sectionTotal.toFixed(1)}ms`);
      }
      console.log(`\nREQUEST TOTAL: ${total.toFixed(1)}ms`);
      console.log(`===========================\n`);
    },
  };

  return api;
}
