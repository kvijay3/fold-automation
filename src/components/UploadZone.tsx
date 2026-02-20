import { useCallback, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface UploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  fastaText: string;
  onFastaTextChange: (text: string) => void;
  onRun: () => void;
  loading: boolean;
}

const ACCEPTED = ['.fasta', '.fa', '.fna', '.ffn'];

export function UploadZone({ files, onFilesChange, fastaText, onFastaTextChange, onRun, loading }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');

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

  const hasInput = files.length > 0 || fastaText.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Input mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setInputMode('file')}
          className="flex-1 py-2 text-xs font-display transition-all duration-150"
          style={{
            border: '1px solid var(--border)',
            background: inputMode === 'file' ? 'var(--surface)' : 'transparent',
            color: inputMode === 'file' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          File Upload
        </button>
        <button
          onClick={() => setInputMode('text')}
          className="flex-1 py-2 text-xs font-display transition-all duration-150"
          style={{
            border: '1px solid var(--border)',
            background: inputMode === 'text' ? 'var(--surface)' : 'transparent',
            color: inputMode === 'text' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          Text Input
        </button>
      </div>

      {inputMode === 'file' ? (
        <>
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
        </>
      ) : (
        /* Text input */
        <textarea
          value={fastaText}
          onChange={(e) => onFastaTextChange(e.target.value)}
          placeholder="Paste FASTA sequence here...\n\n>sequence_name\nAUGCUAGCUAGC..."
          className="w-full px-4 py-3 text-xs font-mono resize-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            height: '200px',
            lineHeight: 1.6,
          }}
        />
      )}

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={!hasInput || loading}
        className="flex items-center justify-center gap-2 w-full font-display text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: hasInput && !loading ? 'var(--accent-red)' : 'var(--border)',
          color: hasInput && !loading ? '#FFFFFF' : 'var(--text-muted)',
          height: '40px',
        }}
      >
        {loading ? 'Processing...' : 'Run Analysis'}
      </button>
    </div>
  );
}
