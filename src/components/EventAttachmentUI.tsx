import React, { useRef, useState } from 'react';
import {
  Calendar,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  MapPin,
  Paperclip,
  X,
} from 'lucide-react';
import { EventAttachment } from '../types/kingdom.ts';
import { processEventAttachmentFile } from '../utils/attachmentHelper.ts';

interface EventAttachmentComposerProps {
  value: Partial<EventAttachment>;
  onChange: (next: Partial<EventAttachment>) => void;
  onRemove: () => void;
  compact?: boolean;
}

export const EventAttachmentComposer: React.FC<EventAttachmentComposerProps> = ({
  value,
  onChange,
  onRemove,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processingFile, setProcessingFile] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setProcessingFile(true);
    try {
      const processed = await processEventAttachmentFile(file);
      onChange({
        ...value,
        type: value.event_title || value.event_date || value.event_location ? 'event' : 'flyer',
        file_name: processed.file_name,
        file_mime: processed.file_mime,
        file_data_url: processed.file_data_url,
      });
    } catch (err: any) {
      setFileError(err?.message || 'Could not attach this file.');
    } finally {
      setProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isPdf = value.file_mime === 'application/pdf';

  return (
    <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-amber-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Attach Event Details or Flyer</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Remove</span>
        </button>
      </div>

      {/* Flyer / File Upload Strip */}
      <div className="flex items-center flex-wrap gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={processingFile}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
        >
          <Paperclip className="w-3.5 h-3.5 text-amber-400" />
          <span>
            {processingFile
              ? 'Preparing flyer...'
              : value.file_data_url
                ? 'Change Flyer / Image'
                : 'Upload Flyer Image or PDF'}
          </span>
        </button>

        {value.file_data_url && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 max-w-full">
            {isPdf ? (
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <img
                src={value.file_data_url}
                alt={value.file_name || 'Event flyer'}
                className="w-7 h-7 rounded object-cover shrink-0"
              />
            )}
            <span className="text-[11px] text-zinc-300 truncate max-w-[160px]">
              {value.file_name || 'Attached flyer'}
            </span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  file_name: undefined,
                  file_mime: undefined,
                  file_data_url: undefined,
                })
              }
              title="Remove file"
              className="text-zinc-500 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {fileError && <p className="text-[11px] text-red-400">{fileError}</p>}

      {/* Event Details Inputs */}
      <div className={`grid gap-2.5 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div className="relative min-w-0">
          <Calendar className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={value.event_title || ''}
            onChange={(e) => onChange({ ...value, type: 'event', event_title: e.target.value })}
            placeholder="Event name (e.g., Night of Glory Vigil)"
            className="w-full min-w-0 pl-8 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <input
          type="text"
          value={value.event_date || ''}
          onChange={(e) => onChange({ ...value, type: 'event', event_date: e.target.value })}
          placeholder="Date & time (e.g., Fri Nov 21 · 7:00 PM WAT)"
          className="w-full min-w-0 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
        />

        <div className="relative min-w-0">
          <MapPin className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={value.event_location || ''}
            onChange={(e) => onChange({ ...value, type: 'event', event_location: e.target.value })}
            placeholder="Location / Venue or Online Stream"
            className="w-full min-w-0 pl-8 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="relative min-w-0">
          <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="url"
            value={value.event_link || ''}
            onChange={(e) => onChange({ ...value, type: 'event', event_link: e.target.value })}
            placeholder="Event registration or stream link (optional)"
            className="w-full min-w-0 pl-8 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>
    </div>
  );
};

interface EventAttachmentCardProps {
  attachment: EventAttachment;
  compact?: boolean;
}

export const EventAttachmentCard: React.FC<EventAttachmentCardProps> = ({
  attachment,
  compact = false,
}) => {
  const [zoomOpen, setZoomOpen] = useState(false);

  const isPdf = attachment.file_mime === 'application/pdf';
  const hasImage = Boolean(attachment.file_data_url && !isPdf);
  const hasMeta = Boolean(
    attachment.event_title ||
      attachment.event_date ||
      attachment.event_location ||
      attachment.event_link
  );

  return (
    <>
      <div className="rounded-xl bg-zinc-950/90 border border-amber-500/25 overflow-hidden flex flex-col">
        {hasImage && attachment.file_data_url && (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="relative group w-full bg-zinc-900 text-left overflow-hidden focus:outline-none"
          >
            <img
              src={attachment.file_data_url}
              alt={attachment.event_title || attachment.file_name || 'Event flyer'}
              className={`w-full object-cover transition-transform duration-200 group-hover:scale-[1.01] ${
                compact ? 'max-h-44' : 'max-h-72'
              }`}
            />
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-black/75 text-[10px] text-zinc-200 border border-white/10">
              <ImageIcon className="w-3 h-3 text-amber-400" />
              <span>Tap to view flyer</span>
            </span>
          </button>
        )}

        {(hasMeta || isPdf) && (
          <div className="p-3 flex flex-col gap-1.5">
            {attachment.event_title && (
              <div className="flex items-start gap-1.5 text-xs sm:text-sm font-semibold text-amber-300">
                <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{attachment.event_title}</span>
              </div>
            )}

            {(attachment.event_date || attachment.event_location) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-300">
                {attachment.event_date && <span>{attachment.event_date}</span>}
                {attachment.event_location && (
                  <span className="inline-flex items-center gap-1 text-zinc-400">
                    <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span>{attachment.event_location}</span>
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {attachment.event_link && (
                <a
                  href={attachment.event_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-[11px] font-medium text-amber-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Event Link</span>
                </a>
              )}

              {isPdf && attachment.file_data_url && (
                <a
                  href={attachment.file_data_url}
                  download={attachment.file_name || 'event-flyer.pdf'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-medium text-zinc-200 transition-colors"
                >
                  <FileText className="w-3 h-3 text-amber-400" />
                  <span>{attachment.file_name || 'Download Event PDF'}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* In-app Lightbox Modal for Event Flyers */}
      {zoomOpen && attachment.file_data_url && (
        <div
          onClick={() => setZoomOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full flex flex-col items-center gap-3"
          >
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              className="self-end inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-100"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
            <img
              src={attachment.file_data_url}
              alt={attachment.event_title || attachment.file_name || 'Event flyer'}
              className="max-h-[82vh] w-auto max-w-full rounded-xl border border-zinc-800 object-contain"
            />
            {(attachment.event_title || attachment.event_date || attachment.event_location) && (
              <div className="text-center text-xs text-zinc-300">
                {attachment.event_title && (
                  <p className="font-semibold text-amber-300">{attachment.event_title}</p>
                )}
                {(attachment.event_date || attachment.event_location) && (
                  <p className="text-zinc-400 mt-0.5">
                    {[attachment.event_date, attachment.event_location].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
