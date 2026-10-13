/** Replace known student names with placeholders before anything leaves the server, then put them back. */
export function scrubNames(text: string, names: string[]): { text: string; restore: (out: string) => string } {
  const used = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);
  const map = new Map<string, string>();
  let next = text;
  used.forEach((name, i) => {
    const token = `دانش‌آموز ${i + 1}`;
    map.set(token, name);
    next = next.split(name).join(token);
  });
  return {
    text: next,
    restore: (out: string) => {
      let back = out;
      for (const [token, name] of map) back = back.split(token).join(name);
      return back;
    },
  };
}
