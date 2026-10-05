/** Rough reading time for Persian/English text (about 200 words a minute). */
export const readingMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));
