export const DEVICE_TYPES = ['phone', 'laptop', 'tablet', 'charger', 'crt_monitor', 'lcd_monitor', 'router', 'set_top_box']

/** Which draft safety pack covers a device type. Types with no pack are sold whole (no dismantling guidance yet). */
export const packFor = (type: string): string | null =>
  ({ phone: 'phone', tablet: 'phone', laptop: 'laptop', crt_monitor: 'crt_monitor' } as Record<string, string>)[type] ?? null
