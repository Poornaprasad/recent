
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-6 sm:p-8">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-3">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            OCR Review
            </h1>
            <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Upload a document to automatically extract key information with AI-powered OCR
            </p>
        </div>

        <div
            {...getRootProps()}
            className={cn(
                "group relative flex flex-col items-center justify-center p-16 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300",
                "bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm",
                "border-border/50 hover:border-primary/60 hover:bg-primary/5",
                "hover:shadow-2xl hover:shadow-primary/10 hover:scale-[1.01]",
                isDragActive && "border-primary bg-primary/10 shadow-xl shadow-primary/20 scale-[1.02]",
                isFocused && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
            )}
        >
            <input {...getInputProps()} />
            <div className={cn(
              "mb-6 transition-all duration-300",
              isDragActive && "scale-110"
            )}>
              <UploadCloud className={cn(
                "w-20 h-20 transition-colors duration-300",
                isDragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"
              )} />
            </div>
            <p className="text-lg font-medium text-center text-foreground mb-2">
              {isDragActive
                ? "Drop the invoice here..."
                : "Drag & drop an invoice PDF or image here"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or <span className="text-primary font-semibold underline underline-offset-2">click to select a file</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {["PDF", "PNG", "JPG", "HEIC"].map((type) => (
                <span key={type} className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
                  {type}
                </span>
              ))}
            </div>
        </div>

        {selectedFile && (
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
            </div>
        )}

        {error && (
            <Alert variant="destructive" className="mt-6 border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <div className="text-center pt-6">
            <Button
            onClick={handleSubmit}
            disabled={!selectedFile}
            size="lg"
            className="h-12 px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
            Process Invoice
            </Button>
        </div>
      </div>
    </div>
  );
}
