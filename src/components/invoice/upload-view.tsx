
"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils/utils';

interface UploadViewProps {
  onFileSelect: (file: File) => void;
  error: string | null;
}

export function UploadView({ onFileSelect, error }: UploadViewProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive, isFocused } = useDropzone({
    onDrop,
    accept: { 
        "application/pdf": [".pdf"],
        "image/png": [".png"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/heic": [".heic"],
    },
    multiple: false,
  });

  const handleSubmit = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
            OCR Review
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
            Upload a document to automatically extract key information.
            </p>
        </div>

        <div
            {...getRootProps()}
            className={cn(
                "flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                "bg-input/20 border-border hover:border-primary/50",
                isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                isFocused && "border-primary"
            )}
        >
            <input {...getInputProps()} />
            <UploadCloud className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-center text-muted-foreground">
              {isDragActive
                ? "Drop the invoice here..."
                : "Drag & drop an invoice PDF or image here, or click to select a file"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, or HEIC files</p>
        </div>

        {selectedFile && (
            <div className="mt-6 flex items-center justify-center space-x-3 p-3 bg-secondary rounded-md">
            <FileText className="w-6 h-6 text-primary" />
            <span className="font-medium text-secondary-foreground">{selectedFile.name}</span>
            </div>
        )}

        {error && (
            <Alert variant="destructive" className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <div className="mt-6 text-center">
            <Button
            onClick={handleSubmit}
            disabled={!selectedFile}
            size="lg"
            >
            Process Invoice
            </Button>
        </div>
      </div>
    </div>
  );
}
