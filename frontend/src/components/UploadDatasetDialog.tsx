import React, { useState, useRef } from "react";
import {
  UploadCloud,
  X,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadDatasetApi } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import type { DatasetDetail } from "@/types/dataset";

interface UploadDatasetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDataset: DatasetDetail) => void;
}

export function UploadDatasetDialog({
  isOpen,
  onClose,
  onSuccess,
}: UploadDatasetDialogProps) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectedFile(null);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (ext !== ".csv" && ext !== ".parquet") {
      setError("Only .csv and .parquet files are supported.");
      return;
    }

    const maxBytes = 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError("File exceeds maximum allowed size of 50 MB.");
      return;
    }

    if (file.size === 0) {
      setError("Selected file is empty (0 bytes).");
      return;
    }

    setSelectedFile(file);
    if (!name.trim()) {
      // Auto-suggest name from filename (without extension)
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      setName(capitalized);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Authentication session expired. Please sign in again.");
      return;
    }

    if (!selectedFile) {
      setError("Please select a CSV or Parquet file to upload.");
      return;
    }

    if (!name.trim()) {
      setError("Please provide a name for this dataset.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", name.trim());
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      const created = await uploadDatasetApi(token, formData);
      resetForm();
      onSuccess(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload and inspect dataset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UploadCloud className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Upload Dataset</h2>
              <p className="text-xs text-muted-foreground">
                CSV or Parquet (up to 50 MB)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drag & Drop File Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : selectedFile
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-muted hover:border-muted-foreground/50 bg-muted/20"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.parquet"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground max-w-[320px] truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatFileSize(selectedFile.size)} &bull;{" "}
                    <span className="uppercase font-mono font-semibold text-primary">
                      {selectedFile.name.endsWith(".parquet") ? "PARQUET" : "CSV"}
                    </span>
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground underline pt-1">
                  Click or drop to replace file
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Click to browse or drag and drop dataset
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Supports .csv and .parquet files up to 50 MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Dataset Name */}
          <div className="space-y-1">
            <label htmlFor="dsName" className="text-xs font-medium text-foreground">
              Dataset Name <span className="text-destructive">*</span>
            </label>
            <input
              id="dsName"
              type="text"
              required
              placeholder="e.g. Q3 Sales Transactions"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label htmlFor="dsDesc" className="text-xs font-medium text-foreground">
              Description <span className="text-muted-foreground text-[10px]">(Optional)</span>
            </label>
            <textarea
              id="dsDesc"
              rows={2}
              placeholder="Context regarding source, pipeline origin, or intended analytical use..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !selectedFile}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Ingesting with DuckDB...
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5" />
                  Upload Dataset
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
