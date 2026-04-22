type ClassValue = string | false | null | undefined;

/** Tiny class-name joiner: keeps truthy strings and joins with a space. */
export function clsx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
