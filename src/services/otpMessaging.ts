/**
 * Customer OTP Messaging utility for SMS and WhatsApp dispatch notifications.
 */

export function buildOtpMessage(otp: string): string {
  return `Your Taxi OTP is: ${otp}\nYour booking is CONFIRMED!\nShare this OTP with the driver to begin your ride.`;
}

export function formatPhoneNumberForWhatsApp(phone?: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^\d+]/g, '');
  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  } else if (clean.length === 10) {
    // 10-digit Indian phone number: prepend country code 91
    clean = '91' + clean;
  }
  return clean;
}

export function formatPhoneNumberForSms(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

export function getWhatsAppOtpUrl(otp: string, phone?: string): string {
  const message = buildOtpMessage(otp);
  const cleanPhone = formatPhoneNumberForWhatsApp(phone);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

export function getSmsOtpUrl(otp: string, phone?: string): string {
  const message = buildOtpMessage(otp);
  const cleanPhone = formatPhoneNumberForSms(phone);
  return `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
}

export async function copyOtpMessageToClipboard(otp: string): Promise<boolean> {
  try {
    const text = buildOtpMessage(otp);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  } catch (err) {
    console.warn('Failed to copy OTP message:', err);
    return false;
  }
}
