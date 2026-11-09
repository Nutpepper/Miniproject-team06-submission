/**
 * Returns a stable Tailwind gradient for a course. New courses automatically
 * receive a different palette without requiring a manually stored color.
 */
const coursePalettes = [
  'from-indigo-500 to-violet-700',
  'from-emerald-500 to-teal-700',
  'from-rose-500 to-pink-700',
  'from-amber-400 to-orange-600',
  'from-cyan-500 to-blue-700',
  'from-fuchsia-500 to-purple-700',
] as const;

export const getCourseBannerColor = (courseId: string) => {
  let hash = 0;
  for (let index = 0; index < courseId.length; index += 1) {
    hash = (hash * 31 + courseId.charCodeAt(index)) | 0;
  }
  return coursePalettes[Math.abs(hash) % coursePalettes.length];
};
