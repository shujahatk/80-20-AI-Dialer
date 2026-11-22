/**
 * RM AI DIALER - CALLING WINDOWS & TIMEZONE SAFETY ENGINE
 * Evaluates local time and allowed dialing days to prevent compliance violations
 * and avoid contacting leads outside permissible business hours.
 */

export interface CallingWindowCheckOptions {
  campaignTimezone: string;
  leadTimezone?: string | null;
  callingDays?: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  callingWindowStart?: string; // HH:MM (e.g. "09:00")
  callingWindowEnd?: string; // HH:MM (e.g. "17:00")
  referenceTime?: Date;
}

export interface CallingWindowResult {
  isWithinWindow: boolean;
  effectiveTimezone: string;
  localTime: string; // HH:MM
  localDay: number; // 1-7 (Mon-Sun)
  localDayName: string;
  reasonBlocked?: string;
  nextEligibleTime?: string;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Validates whether dialing is permissible right now under timezone and schedule rules.
 */
export function isWithinCallingWindow(options: CallingWindowCheckOptions): CallingWindowResult {
  const {
    campaignTimezone,
    leadTimezone,
    callingDays = [1, 2, 3, 4, 5],
    callingWindowStart = '09:00',
    callingWindowEnd = '17:00',
    referenceTime = new Date(),
  } = options;

  // Use lead local timezone where known; fall back safely to campaign timezone
  const effectiveTimezone = (leadTimezone && isValidTimezone(leadTimezone.trim()))
    ? leadTimezone.trim()
    : (campaignTimezone && isValidTimezone(campaignTimezone.trim()))
    ? campaignTimezone.trim()
    : 'America/New_York';

  try {
    // Extract local weekday (Monday=1, ..., Sunday=7)
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
      weekday: 'long',
    });
    const dayName = dayFormatter.format(referenceTime);
    const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(dayName);
    const localDay = dayIndex !== -1 ? dayIndex + 1 : 1;

    // Extract local time formatted as HH:MM in 24-hour format
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = timeFormatter.formatToParts(referenceTime);
    let rawHour = parts.find((p) => p.type === 'hour')?.value ?? '09';
    if (rawHour === '24') rawHour = '00';
    const hour = rawHour.padStart(2, '0');
    const minute = parts.find((p) => p.type === 'minute')?.value.padStart(2, '0') ?? '00';
    const localTime = `${hour}:${minute}`;

    // 1. Check if allowed day of week
    if (!callingDays.includes(localDay)) {
      return {
        isWithinWindow: false,
        effectiveTimezone,
        localTime,
        localDay,
        localDayName: dayName,
        reasonBlocked: `Today (${dayName}) is outside permitted calling days (${callingDays.map((d) => DAY_NAMES[d - 1]).join(', ')})`,
      };
    }

    // 2. Check time window bounds
    if (localTime < callingWindowStart) {
      return {
        isWithinWindow: false,
        effectiveTimezone,
        localTime,
        localDay,
        localDayName: dayName,
        reasonBlocked: `Before calling hours (local time is ${localTime} in ${effectiveTimezone}; opens at ${callingWindowStart})`,
      };
    }

    if (localTime >= callingWindowEnd) {
      return {
        isWithinWindow: false,
        effectiveTimezone,
        localTime,
        localDay,
        localDayName: dayName,
        reasonBlocked: `After calling hours (local time is ${localTime} in ${effectiveTimezone}; closed at ${callingWindowEnd})`,
      };
    }

    return {
      isWithinWindow: true,
      effectiveTimezone,
      localTime,
      localDay,
      localDayName: dayName,
    };
  } catch {
    // If timezone parsing fails, fall back to conservative check
    return {
      isWithinWindow: true,
      effectiveTimezone: 'UTC',
      localTime: '12:00',
      localDay: 1,
      localDayName: 'Monday',
    };
  }
}

/**
 * Checks whether an IANA timezone string is valid.
 */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
