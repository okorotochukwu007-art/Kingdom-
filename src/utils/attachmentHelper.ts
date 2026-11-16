import { EventAttachment } from '../types/kingdom.ts';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function sanitizeEventUrl(raw: string | undefined): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

export function isAttachmentPopulated(att: Partial<EventAttachment> | null | undefined): boolean {
  if (!att) return false;
  return Boolean(
    att.event_title?.trim() ||
      att.event_date?.trim() ||
      att.event_location?.trim() ||
      att.event_link?.trim() ||
      att.file_data_url
  );
}

export function normalizeOutgoingAttachment(
  att: Partial<EventAttachment> | null | undefined
): EventAttachment | undefined {
  if (!isAttachmentPopulated(att)) return undefined;
  const safeLink = sanitizeEventUrl(att?.event_link);
  const hasEventMeta = Boolean(
    att?.event_title?.trim() || att?.event_date?.trim() || att?.event_location?.trim() || safeLink
  );
  return {
    type: hasEventMeta ? 'event' : 'flyer',
    event_title: att?.event_title?.trim() || undefined,
    event_date: att?.event_date?.trim() || undefined,
    event_location: att?.event_location?.trim() || undefined,
    event_link: safeLink || undefined,
    file_name: att?.file_name?.trim() || undefined,
    file_mime: att?.file_mime?.trim() || undefined,
    file_data_url: att?.file_data_url || undefined,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function compressImageDataUrl(dataUrl: string, maxWidth = 1080, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function processEventAttachmentFile(
  file: File
): Promise<{ file_name: string; file_mime: string; file_data_url: string }> {
  const mime = (file.type || '').toLowerCase();
  const isImage = ALLOWED_IMAGE_TYPES.has(mime) || mime.startsWith('image/');
  const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isImage && !isPdf) {
    throw new Error('Please choose an image flyer (JPG, PNG, WebP) or a PDF event file.');
  }

  if (isPdf) {
    if (file.size > 1.5 * 1024 * 1024) {
      throw new Error('PDF flyer must be 1.5 MB or smaller.');
    }
    const dataUrl = await readFileAsDataUrl(file);
    return {
      file_name: file.name,
      file_mime: 'application/pdf',
      file_data_url: dataUrl,
    };
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image file must be 8 MB or smaller.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  if (mime === 'image/gif' && rawDataUrl.length <= 700_000) {
    return {
      file_name: file.name,
      file_mime: mime,
      file_data_url: rawDataUrl,
    };
  }

  const compressedUrl = await compressImageDataUrl(rawDataUrl, 1080, 0.8);
  return {
    file_name: file.name,
    file_mime: 'image/jpeg',
    file_data_url: compressedUrl,
  };
}
