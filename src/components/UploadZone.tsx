import { useCallback, useRef, useState } from 'react';
import { Upload, X, PlayCircle } from 'lucide-react';

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
    <div className="flex flex-col gap-3 px-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="relative cursor-pointer rounded-lg p-5 flex flex-col items-center gap-2 transition-all duration-300"
        style={{
          border: `2px dashed ${dragging ? 'var(--accent-cyan)' : 'var(--border)'}`,
          boxShadow: dragging ? '0 0 20px var(--border-glow)' : 'none',
          background: dragging ? 'rgba(34,211,238,0.03)' : 'transparent',
        }}
      >
        {files.length === 0 ? (
          <>
            <div
              className="text-4xl animate-pulse-slow"
              style={{ color: 'var(--accent-cyan)' }}
            >
              ◈
            </div>
            <p className="font-display text-xl tracking-widest" style={{ color: 'var(--text-primary)' }}>
              DROP FASTA FILES
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
              or click to browse
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
              {ACCEPTED.join(' · ')}
            </p>
          </>
        ) : (
          <>
            <Upload size={20} style={{ color: 'var(--accent-cyan)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Figtree, sans-serif' }}>
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
              className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs"
              style={{
                background: 'rgba(26,37,64,0.6)',
                border: '1px solid var(--border)',
                fontFamily: 'Figtree, sans-serif',
                color: 'var(--text-primary)',
              }}
            >
              <span className="truncate max-w-[150px]" title={f.name}>{f.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="ml-2 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
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
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-display tracking-widest text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: files.length > 0 && !loading
            ? 'linear-gradient(135deg, #0e7490, #22D3EE)'
            : 'var(--border)',
          color: files.length > 0 && !loading ? '#050810' : 'var(--text-muted)',
          boxShadow: files.length > 0 && !loading ? '0 0 16px rgba(34,211,238,0.25)' : 'none',
        }}
      >
        <PlayCircle size={16} />
        {loading ? 'PROCESSING…' : 'RUN PIPELINE'}
      </button>
    </div>
  );
}
