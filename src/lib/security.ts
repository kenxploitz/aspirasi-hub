// ============================================================
// Security Utilities — Input Sanitization & XSS Prevention
// Fixes: XSS via dangerouslySetInnerHTML, PDF injection
// ============================================================

import DOMPurify from "dompurify";

/**
 * Sanitize user input for safe display
 * Strips all HTML tags, event handlers, and dangerous protocols
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }).trim();
}

/**
 * Sanitize content for safe HTML rendering (if needed)
 * Only allows basic formatting tags
 */
export function sanitizeHTML(input: string): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitize content for PDF generation
 * Strips everything that could be interpreted as code
 */
export function sanitizeForPDF(input: string): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/\\/g, "&#x5C;")
    .trim();
}

/**
 * Validate and sanitize student name
 */
export function sanitizeStudentName(name: string): string {
  if (!name) return "Anonim";
  const cleaned = name
    .replace(/[<>\"'&]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 && cleaned.length <= 100 ? cleaned : "Anonim";
}

/**
 * Validate and sanitize student class
 */
export function sanitizeStudentClass(className: string): string | null {
  if (!className) return null;
  const cleaned = className
    .replace(/[<>\"'&]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 && cleaned.length <= 50 ? cleaned : null;
}

/**
 * Validate aspiration content
 */
export function validateContent(content: string): { valid: boolean; error?: string } {
  if (!content || typeof content !== "string") {
    return { valid: false, error: "Aspirasi wajib diisi." };
  }
  const trimmed = content.trim();
  if (trimmed.length < 10) {
    return { valid: false, error: "Aspirasi minimal 10 karakter." };
  }
  if (trimmed.length > 2000) {
    return { valid: false, error: "Aspirasi maksimal 2000 karakter." };
  }
  return { valid: true };
}

/**
 * Basic client-side spam detection
 */
export function detectSpam(text: string): boolean {
  const spamPatterns = [
    /buy\s*now/i,
    /click\s*here/i,
    /free\s*money/i,
    /casino/i,
    /viagra/i,
    /porn/i,
    /\bxxx\b/i,
    /bitcoin.*invest/i,
    /whatsapp.*\d{10,}/i,
    /wa\.me\/\d+/i,
  ];
  return spamPatterns.some((pattern) => pattern.test(text));
}
