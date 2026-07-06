export function getMillisecondsUntilNextMinute(value: Date): number {
  return 60_000 - (value.getSeconds() * 1000 + value.getMilliseconds());
}
