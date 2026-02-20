import { useCallback, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface UploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRun: () => void;
  loading: boolean;
}

const ACCEPTED = ['.fasta', '.fa', '.fna', '.ffn'];

export function UploadZone({ files, onFilesChange, onRun, loading }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming).filter((f) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return ACCEPTED.includes(ext);
      });
      if (!arr.length) return;
      onFilesChange([...files, ...arr]);
    },
    [files, onFilesChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeFile = (i: number) => {
    onFilesChange(files.filter((_, idx) => idx !== i));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="relative cursor-pointer flex flex-col items-center justify-center gap-2 transition-all duration-200"
        style={{
          border: `1px dashed ${dragging ? 'var(--accent-red)' : 'var(--border)'}`,
          background: dragging ? 'var(--surface)' : 'var(--surface)',
          height: '120px',
        }}
      >
        {files.length === 0 ? (
          <>
            <span style={{ fontSize: '24px', color: 'var(--text-muted)' }}>
              ↑
            </span>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Drop FASTA files
            </p>
          </>
        ) : (
          <>
            <Upload size={16} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Drop more files
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="sr-only"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* File pills */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 text-xs"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="truncate max-w-[150px]" title={f.name}>{f.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="ml-2 flex-shrink-0 hover:opacity-60 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={files.length === 0 || loading}
        className="flex items-center justify-center gap-2 w-full font-display text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: files.length > 0 && !loading ? 'var(--accent-red)' : 'var(--border)',
          color: files.length > 0 && !loading ? '#FFFFFF' : 'var(--text-muted)',
          height: '40px',
        }}
      >
        {loading ? 'Processing...' : 'Run Analysis'}
      </button>
    </div>
  );
}
