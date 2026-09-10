/**
 * Smart Booking Text Parser
 * Intelligently auto-detects ("deducts") booking details from ANY type/format of pasted text:
 * - WhatsApp booking confirmations (with emojis 🚖📍🏁👤📞, asterisks, bullets)
 * - Labeled forms (Pickup: ..., Drop: ..., From: ..., To: ...)
 * - Arrow / Dash route formats (e.g. "Coimbatore -> Ooty", "CBE to BLR")
 * - Unstructured natural language (e.g. "Ramesh 9876543210 Gandhipuram to Airport Sedan 1200")
 * - Hourly / Local rental packages (e.g. "4hr 40km", "8 hrs / 80 km package")
 * - Tabular / Spreadsheet copied rows (tab-delimited or pipe-delimited)
 * - Google Maps links with coordinates
 */

import { VehicleCategory, TripType } from '../types';

export interface ParsedBookingData {
  customerName?: string;
  customerPhone?: string;
  tripType: TripType;
  isPackage: boolean;
  pickupLocation: string;
  dropLocation: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  packageHours?: string;
  packageKms?: string;
  vehicleCategory: VehicleCategory;
  estimatedFare?: string;
  date?: string;
  time?: string;
  notes?: string;
  rawText: string;
  confidence: {
    hasPhone: boolean;
    hasPickup: boolean;
    hasDropOrPackage: boolean;
    hasFare: boolean;
  };
}

/**
 * Normalizes vehicle names into accepted VehicleCategory enum
 */
export function normalizeVehicleCategory(rawVehicle: string): VehicleCategory {
  const upper = rawVehicle.toUpperCase().trim();
  if (upper.includes('CRYSTA')) return 'INNOVA CRYSTA';
  if (upper.includes('INNOVA')) return 'INNOVA';
  if (upper.includes('SUV+') || upper.includes('SUV PLUS') || upper.includes('XUV') || upper.includes('FORTUNER') || upper.includes('SCORPIO') || upper.includes('SAFARI')) return 'SUV+';
  if (upper.includes('SUV') || upper.includes('ERTIGA') || upper.includes('MARAZZO') || upper.includes('CARENS') || upper.includes('XL6') || upper.includes('TRIBER')) return 'SUV';
  if (upper.includes('MINI') || upper.includes('HATCHBACK') || upper.includes('WAGON') || upper.includes('SWIFT') || upper.includes('INDICA') || upper.includes('I10') || upper.includes('TIAGO') || upper.includes('CELERIO') || upper.includes('ALTO')) return 'MINI';
  if (upper.includes('SEDAN') || upper.includes('DZIRE') || upper.includes('ETIOS') || upper.includes('AURA') || upper.includes('TIGOR') || upper.includes('VERITO') || upper.includes('AMAZE') || upper.includes('CITY')) return 'SEDAN';
  if (upper.includes('TRAVELLER') || upper.includes('TEMPO') || upper.includes('BUS') || upper.includes('COACH') || upper.includes('FORCE')) return 'CUSTOM';
  return 'SEDAN'; // default safe category
}

interface ExtractedLocation {
  address: string;
  lat?: number;
  lng?: number;
  mapUrl?: string;
}

/**
 * Strips formatting artifacts like emojis, markdown, and bullets from labels and values
 */
function cleanTextFragment(val: string): string {
  if (!val) return '';
  return val
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/gu, ' ') // emojis
    .replace(/^[\s•\-\*▪▫🔹–—>→⇒]+\s*/, '') // leading bullet symbols
    .replace(/\*+/g, '') // bold
    .replace(/_+/g, ' ') // underscores
    .replace(/\s+/g, ' ') // collapse multi-spaces
    .trim();
}

/**
 * Normalizes city/station acronyms (e.g. CBE -> Coimbatore)
 */
function expandKnownCityAliases(loc: string): string {
  let res = loc;
  res = res.replace(/\bCBE\b/gi, 'Coimbatore');
  res = res.replace(/\bBLR\b/gi, 'Bangalore');
  res = res.replace(/\bMAA\b/gi, 'Chennai');
  res = res.replace(/\bCJB\b/gi, 'Coimbatore Airport');
  return res;
}

/**
 * Extracts location blocks that can span multiple lines or include Google Maps URLs
 */
function extractLocationBlock(
  text: string,
  labelPatterns: string[]
): ExtractedLocation | null {
  for (const label of labelPatterns) {
    // Matches labels like: *Pickup:* or Pickup: or 📍 Pickup - or [Pickup] =
    const sectionRegex = new RegExp(
      `(?:^|\\n)\\s*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]*\\s*\\*?(?:${label})\\*?\\s*[:=\\-–—>→⇒]+\\s*\\*?([\\s\\S]*?)(?=(?:\\n\\s*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]*\\s*\\*?(?:Drop|Pickup|Destination|Origin|From|To|Vehicle|Car|Cab|Phone|Mobile|Fare|Total|Price|Package|Customer|Passenger|Name|Trip|Date|Time|Departure|Boarding)\\*?\\s*[:=\\-–—>→⇒])|$)`,
      'iu'
    );
    const m = text.match(sectionRegex);
    if (m && m[1]) {
      const block = m[1].trim();
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let address = '';
      let mapUrl = '';
      let lat: number | undefined;
      let lng: number | undefined;

      for (const line of lines) {
        if (/https?:\/\//i.test(line) || /maps\.google/i.test(line) || /goo\.gl/i.test(line)) {
          mapUrl = line.replace(/^(?:Maps|Google\s*Maps|Link|Location|URL)\s*[:=\\-]+\s*/i, '').trim();
          const coordMatch = mapUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)|@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (coordMatch) {
            lat = parseFloat(coordMatch[1] || coordMatch[3]);
            lng = parseFloat(coordMatch[2] || coordMatch[4]);
          } else {
            const qParam = mapUrl.match(/[?&]q=([^&]+)/);
            if (qParam && !address) {
              try {
                address = decodeURIComponent(qParam[1].replace(/\+/g, ' ')).trim();
              } catch {}
            }
          }
        } else if (!address && !/^(?:Maps|Google\s*Maps|Link|URL)\s*[:=\\-]/i.test(line)) {
          const cleanLine = cleanTextFragment(line);
          if (cleanLine) {
            address = cleanLine;
          }
        }
      }

      if (address || lat) {
        return { address: expandKnownCityAliases(address), lat, lng, mapUrl };
      }
    }
  }
  return null;
}

/**
 * Intelligent parser that extracts booking details from ANY pasted text format
 */
export function parseBookingText(rawText: string): ParsedBookingData {
  const text = (rawText || '').trim();
  if (!text) {
    return {
      tripType: 'REGULAR',
      isPackage: false,
      pickupLocation: '',
      dropLocation: '',
      vehicleCategory: 'MINI',
      rawText: '',
      confidence: { hasPhone: false, hasPickup: false, hasDropOrPackage: false, hasFare: false },
    };
  }

  let customerName = '';
  let customerPhone = '';
  let tripType: TripType = 'REGULAR';
  let isPackage = false;
  let pickupLocation = '';
  let dropLocation = '';
  let pickupLat: number | undefined;
  let pickupLng: number | undefined;
  let dropLat: number | undefined;
  let dropLng: number | undefined;
  let packageHours = '';
  let packageKms = '';
  let vehicleCategory: VehicleCategory = 'MINI';
  let estimatedFare = '';
  let date = '';
  let time = '';
  let notes = '';

  // Helper to find regex match in raw or cleaned text
  const findMatch = (regexes: RegExp[]): string => {
    for (const rx of regexes) {
      const match = text.match(rx);
      if (match && match[1]) {
        return cleanTextFragment(match[1]);
      }
    }
    return '';
  };

  // ==========================================
  // 1. PHONE NUMBER DETECTION
  // ==========================================
  // Check labeled phone first: Phone, Mobile, Contact, Ph, Cell, WhatsApp, Call
  const phoneLabel = findMatch([
    /(?:\*?(?:Phone|Mobile|Contact|Ph(?:one)?|Mob|Cell|Tel|WhatsApp|WP|Call)(?:\s*(?:Number|No|Num))?\*?)\s*[:=\\-–—>]+\s*([+0-9\s()-]{10,18})/i,
    /(?:Contact|Phone|Mobile)\s*#?\s*[:=\\-–—]?\s*([+0-9\s()-]{10,18})/i,
  ]);

  if (phoneLabel) {
    const digits = phoneLabel.replace(/\D/g, '');
    if (digits.length >= 10) {
      customerPhone = digits.slice(-10);
    } else if (digits.length >= 7) {
      customerPhone = digits;
    }
  }

  // If still no phone, scan for any standard 10-digit Indian mobile number in the whole text
  if (!customerPhone) {
    const genericPhoneMatch = text.match(/(?:(?:\+91|0|91)[-\s]?)?([6-9]\d{9})\b/);
    if (genericPhoneMatch && genericPhoneMatch[1]) {
      customerPhone = genericPhoneMatch[1];
    }
  }

  // ==========================================
  // 2. PACKAGE / RENTAL DETECTION
  // ==========================================
  // Matches "4hr 40km", "4 hr / 40 km", "8 hours 80 kms", "4/40", "Local package 8hr80km"
  const packageMatch = text.match(/(\d{1,2})\s*(?:hr|hour|hrs|hours)\s*(?:[\/,\-&]|and)?\s*(\d{1,3})\s*(?:km|kms|kilometer|kilometres)/i) ||
    text.match(/(?:package|rental|local)\s*[:=\\-–—]?\s*(\d{1,2})\s*[\/-]\s*(\d{1,3})/i);

  if (packageMatch) {
    tripType = 'PACKAGE';
    isPackage = true;
    packageHours = packageMatch[1];
    packageKms = packageMatch[2];
  } else {
    // Check general rental / hourly keyword
    const tripTypeStr = findMatch([
      /(?:\*?(?:Trip(?:\s*Type)?|Booking(?:\s*Type)?|Category|Service(?:\s*Type)?)\*?)\s*[:=\\-–—>]+\s*([^\n\r]+)/i,
    ]);
    if (/rental|package|hourly|local/i.test(tripTypeStr) || /\brental package\b/i.test(text) || /\bhourly rental\b/i.test(text)) {
      tripType = 'PACKAGE';
      isPackage = true;
      const hMatch = text.match(/(\d{1,2})\s*(?:hr|hour|hrs|hours)/i);
      if (hMatch) packageHours = hMatch[1];
      const kMatch = text.match(/(\d{1,3})\s*(?:km|kms|kilometer|kilometres)/i);
      if (kMatch) packageKms = kMatch[1];
    }
  }

  // ==========================================
  // 3. PICKUP & DROP LOCATION EXTRACTION
  // ==========================================
  // A. Try explicit multi-line / rich location blocks
  const pickupBlock = extractLocationBlock(text, [
    'Pickup(?:\\s*(?:Location|Address|Point|Area|Stop))?',
    'Pick[\\s-]*up(?:\\s*(?:Location|Address|Point|Area))?',
    'Boarding(?:\\s*(?:Point|Location|Address))?',
    'From',
    'Origin',
    'Source',
    'Start(?:\\s*(?:Point|Location))?',
  ]);

  if (pickupBlock) {
    pickupLocation = pickupBlock.address;
    if (pickupBlock.lat && pickupBlock.lng) {
      pickupLat = pickupBlock.lat;
      pickupLng = pickupBlock.lng;
    }
  } else {
    // Single-line regex search
    pickupLocation = findMatch([
      /(?:\*?(?:Pickup|Pick[\\s-]*up|Boarding|From|Origin|Source|Start)(?:\s*(?:Location|Address|Point|Area))?\*?)\s*[:=\\-–—>]+\s*([^\n\r,;|]+)/i,
    ]);
  }

  const dropBlock = extractLocationBlock(text, [
    'Drop(?:\\s*(?:Location|Address|Point|Area|Stop))?',
    'Drop[\\s-]*off(?:\\s*(?:Location|Address|Point|Area))?',
    'Dropping(?:\\s*(?:Point|Location|Address))?',
    'Destination',
    'Dest',
    'To',
    'End(?:\\s*(?:Point|Location))?',
  ]);

  if (dropBlock) {
    dropLocation = dropBlock.address;
    if (dropBlock.lat && dropBlock.lng) {
      dropLat = dropBlock.lat;
      dropLng = dropBlock.lng;
    }
  } else {
    // Single-line regex search
    dropLocation = findMatch([
      /(?:\*?(?:Drop|Drop[\\s-]*off|Dropping|Destination|Dest|To|End)(?:\s*(?:Location|Address|Point|Area))?\*?)\s*[:=\\-–—>]+\s*([^\n\r,;|]+)/i,
    ]);
  }

  // B. Route shorthand detection (e.g. "Gandhipuram to Airport" or "Coimbatore -> Ooty" or "Salem - Chennai")
  if (!pickupLocation || !dropLocation) {
    // Check arrow routes: [Pickup] -> [Drop] or [Pickup] => [Drop] or [Pickup] – [Drop]
    const arrowMatch = text.match(/(?:^|\n|\b)(?:Route\s*[:=\\-]+\s*)?([A-Za-z0-9\s.,'()-]{3,40})\s*(?:->|-->|=>|–|—)\s*([A-Za-z0-9\s.,'()-]{3,40})/i);
    if (arrowMatch) {
      const pCandidate = cleanTextFragment(arrowMatch[1]);
      const dCandidate = cleanTextFragment(arrowMatch[2]);
      if (!pickupLocation && pCandidate && !/^(phone|car|date|time|cab|fare|rs|inr)/i.test(pCandidate)) {
        pickupLocation = expandKnownCityAliases(pCandidate);
      }
      if (!dropLocation && dCandidate && !/^(phone|car|date|time|cab|fare|rs|inr)/i.test(dCandidate)) {
        dropLocation = expandKnownCityAliases(dCandidate);
      }
    }
  }

  if (!pickupLocation || !dropLocation) {
    // Check "From X to Y" or "X to Y" in freeform text
    const toMatch = text.match(/(?:(?:from|trip\s*from)\s+)?([A-Za-z0-9\s.,'()-]{2,35})\s+(?:to|drop\s+to|going\s+to)\s+([A-Za-z0-9\s.,'()-]{2,35})/i);
    if (toMatch) {
      const pCandidate = cleanTextFragment(toMatch[1]);
      const dCandidate = cleanTextFragment(toMatch[2]);
      if (!pickupLocation && pCandidate && !/^(phone|car|date|time|cab|fare|rs|inr)/i.test(pCandidate)) {
        pickupLocation = expandKnownCityAliases(pCandidate);
      }
      if (!dropLocation && dCandidate && !/^(phone|car|date|time|cab|fare|rs|inr)/i.test(dCandidate)) {
        dropLocation = expandKnownCityAliases(dCandidate);
      }
    }
  }

  // Clean locations
  pickupLocation = expandKnownCityAliases(cleanTextFragment(pickupLocation));
  dropLocation = expandKnownCityAliases(cleanTextFragment(dropLocation));

  // If it's a package and drop location is empty, set friendly package name
  if (isPackage && !dropLocation) {
    dropLocation = packageHours || packageKms
      ? `Local Package (${packageHours || '0'}h / ${packageKms || '0'}km)`
      : 'Local Rental Package';
  }

  // ==========================================
  // 4. CUSTOMER NAME EXTRACTION
  // ==========================================
  // Check labeled name
  customerName = findMatch([
    /(?:\*?(?:Customer(?:\s*Name)?|Passenger(?:\s*Name)?|Guest(?:\s*Name)?|Pax|Client|Lead(?:\s*Name)?|Booked\s*by|Name)\*?)\s*[:=\\-–—>]+\s*([^\n\r,;|]+)/i,
  ]);

  if (!customerName) {
    // Check for Honorific prefix: Mr. / Mrs. / Ms. / Dr.
    const titleMatch = text.match(/\b(Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+([A-Za-z\s]{2,30})/i);
    if (titleMatch) {
      customerName = `${titleMatch[1]} ${titleMatch[2]}`.trim();
    }
  }

  // If still not found, check if first line before phone has a 1-3 word person name
  if (!customerName && customerPhone) {
    const lines = text.split(/\r?\n/).map((l) => cleanTextFragment(l)).filter(Boolean);
    for (const line of lines) {
      if (line.includes(customerPhone)) continue;
      // Skip if line has keywords
      if (/pickup|drop|date|time|fare|cab|car|vehicle|package|sedan|innova|rs|inr|to|from/i.test(line)) continue;
      if (/^[A-Za-z\s.]{2,30}$/.test(line) && line.split(/\s+/).length <= 4) {
        customerName = line;
        break;
      }
    }
  }

  customerName = cleanTextFragment(customerName) || 'Customer';

  // ==========================================
  // 5. VEHICLE CATEGORY DETECTION
  // ==========================================
  const rawVehicle = findMatch([
    /(?:\*?(?:Vehicle(?:\s*Type|\s*Model|\s*Category)?|Car(?:\s*Type|\s*Model)?|Cab(?:\s*Type)?|Taxi|Segment)\*?)\s*[:=\\-–—>]+\s*([^\n\r,;|]+)/i,
  ]);

  if (rawVehicle) {
    vehicleCategory = normalizeVehicleCategory(rawVehicle);
  } else {
    // Scan full text for prominent vehicle names
    if (/crysta/i.test(text)) vehicleCategory = 'INNOVA CRYSTA';
    else if (/innova/i.test(text)) vehicleCategory = 'INNOVA';
    else if (/suv\+|suv plus|xuv|fortuner|scorpio|safari/i.test(text)) vehicleCategory = 'SUV+';
    else if (/suv|ertiga|marazzo|carens|xl6|triber/i.test(text)) vehicleCategory = 'SUV';
    else if (/sedan|etios|dzire|aura|tigor|verito|amaze/i.test(text)) vehicleCategory = 'SEDAN';
    else if (/mini|hatchback|wagon\s*r|swift|indica|i10|tiago|alto/i.test(text)) vehicleCategory = 'MINI';
    else if (/traveller|tempo|mini\s*bus|coach/i.test(text)) vehicleCategory = 'CUSTOM';
  }

  // ==========================================
  // 6. ESTIMATED FARE EXTRACTION
  // ==========================================
  // Labeled fare: Total, Fare, Estimated Fare, Price, Amount, Quote, Cost
  const fareStr = findMatch([
    /(?:\*?(?:Estimated\s*Fare|Total\s*Fare|Total\s*Amount|Net\s*Fare|Fare|Price|Amount|Quote|Cost|Rate|Bill)\*?)\s*[:=\\-–—>]+\s*(?:₹|Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]+)?)/i,
    /(?:₹|Rs\.?|INR)\s*([0-9,]{3,7})/i,
    /(\d{3,6})\s*(?:\/-\s*|rs\.?|inr)/i,
  ]);

  if (fareStr) {
    const cleanFare = fareStr.replace(/,/g, '').replace(/[^\d.]/g, '').trim();
    if (!isNaN(Number(cleanFare)) && Number(cleanFare) > 0) {
      estimatedFare = String(Math.round(Number(cleanFare)));
    }
  }

  // ==========================================
  // 7. DATE & TIME EXTRACTION
  // ==========================================
  const dateTimeStr = findMatch([
    /(?:\*?(?:Date\/Time|Departure|Date\s*&\s*Time|Reporting\s*Time|Pickup\s*Time)\*?)\s*[:=\\-–—>]+\s*([^\n\r]+)/i,
  ]);

  if (dateTimeStr) {
    const datePart = dateTimeStr.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
    if (datePart) date = datePart[1];

    const timePart = dateTimeStr.match(/\b(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)\b/i);
    if (timePart) time = timePart[1];
  } else {
    const dStr = findMatch([/(?:\*?Date\*?)\s*[:=\\-–—>]+\s*([^\n\r]+)/i]);
    if (dStr) {
      const dMatch = dStr.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
      date = dMatch ? dMatch[1] : cleanTextFragment(dStr);
    }

    const tStr = findMatch([/(?:\*?Time\*?)\s*[:=\\-–—>]+\s*([^\n\r]+)/i]);
    if (tStr) {
      const tMatch = tStr.match(/\b(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)\b/i);
      time = tMatch ? tMatch[1] : cleanTextFragment(tStr);
    }
  }

  // ==========================================
  // 8. NOTES & SPECIAL INSTRUCTIONS
  // ==========================================
  const notesStr = findMatch([
    /(?:\*?(?:Notes?|Instructions?|Special\s*Instructions?|Remarks?|Comments?)\*?)\s*[:=\\-–—>]+\s*([^\n\r]+)/i,
  ]);
  if (notesStr) {
    notes = cleanTextFragment(notesStr);
  }

  if (date || time) {
    const scheduleText = `Schedule: ${date || ''} ${time || ''}`.trim();
    notes = notes ? `${notes} • ${scheduleText}` : scheduleText;
  }

  // ==========================================
  // 9. TABULAR / DELIMITED FALLBACK (e.g. from Excel)
  // ==========================================
  if ((!pickupLocation || !customerPhone) && text.includes('\t')) {
    const cols = text.split('\t').map((c) => cleanTextFragment(c)).filter(Boolean);
    for (const col of cols) {
      const digits = col.replace(/\D/g, '');
      if (!customerPhone && digits.length === 10 && /^[6-9]/.test(digits)) {
        customerPhone = digits;
      } else if (!pickupLocation && col.length > 2 && !/^\d+$/.test(col)) {
        pickupLocation = col;
      } else if (!dropLocation && col.length > 2 && !/^\d+$/.test(col) && col !== pickupLocation) {
        dropLocation = col;
      } else if (!estimatedFare && /^\d+$/.test(col) && Number(col) >= 100) {
        estimatedFare = col;
      }
    }
  }

  // Final confidence assessment
  const hasPhone = customerPhone.length === 10;
  const hasPickup = Boolean(pickupLocation);
  const hasDropOrPackage = Boolean(dropLocation || (isPackage && (packageHours || packageKms)));
  const hasFare = Boolean(estimatedFare);

  return {
    customerName,
    customerPhone,
    tripType,
    isPackage,
    pickupLocation,
    dropLocation,
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
    packageHours,
    packageKms,
    vehicleCategory,
    estimatedFare,
    date,
    time,
    notes,
    rawText: text,
    confidence: {
      hasPhone,
      hasPickup,
      hasDropOrPackage,
      hasFare,
    },
  };
}
