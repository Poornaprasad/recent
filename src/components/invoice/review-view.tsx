
"use client";

import type { StoredInvoice } from "@/lib/invoice-types";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ConfidenceBadge } from "./confidence-badge";
import { ScrollArea } from "../ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useState, useMemo } from "react";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import Image from "next/image";
import { cn } from "@/lib/utils";
import dynamic from 'next/dynamic';
import { CircularProgressBadge } from "./circular-progress-badge";

const PDFViewer = dynamic(() => import('@/components/invoice/pdf-viewer').then(mod => mod.PDFViewer), {
  ssr: false,
  loading: () => <p>Loading PDF...</p>
});


interface ReviewViewProps {
  data: StoredInvoice;
  invoicePreviewUrl: string;
  onSave: (data: any) => void;
  onReset: () => void;
}

type BoundingBox = { x: number; y: number }[];

const toTitleCase = (str: string) => {
  if (!str) return '';
  str = str.replace(/([A-Z])/g, ' $1');
  str = str.replace(/(\d+)/g, ' $1');
  return str.replace(/^./, (s) => s.toUpperCase());
};


export function ReviewView({
  data,
  invoicePreviewUrl,
  onSave,
  onReset,
}: ReviewViewProps) {
  const [highlightBox, setHighlightBox] = useState<BoundingBox | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [caseNumber, setCaseNumber] = useState<string | undefined>(data.caseNumber);

  const initialFields = useMemo(() => {
    const fields = [];
    for (const [key, value] of Object.entries(data)) {
        if (['id', 'invoiceDataUri', 'status', 'isDuplicate', 'duplicateReason'].includes(key) || value === null) continue;

        if (key === 'lineItems' && value && Array.isArray(value.value)) {
             fields.push({
                fieldName: key,
                originalFieldName: key,
                ...value,
            });
        } else if (value && typeof value === 'object') {
            fields.push({ fieldName: key, ...value });
        }
    }
    return fields;
  }, [data]);

  const form = useForm({
    defaultValues: {
      fields: initialFields
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "fields"
  });

  const onSubmit = (formData: any) => {
     const reconstructedData = formData.fields.reduce((acc: any, field: any) => {
        if (field.fieldName === 'lineItems') {
            acc.lineItems = {
                value: field.value,
                confidence: field.confidence,
                reasoning: field.reasoning,
                bbox: field.bbox,
            };
        } else {
            acc[field.fieldName] = {
                value: field.value,
                confidence: field.confidence,
                reasoning: field.reasoning,
                bbox: field.bbox,
            };
        }
        return acc;
    }, {});
    
    // Re-add fields that were not part of the form
    for(const key of ['id', 'invoiceDataUri', 'status', 'isDuplicate', 'duplicateReason']) {
        if (data[key as keyof StoredInvoice] !== undefined) {
            reconstructedData[key] = data[key as keyof StoredInvoice];
        }
    }

    // Add case number
    if (caseNumber) {
      reconstructedData.caseNumber = caseNumber;
    }

    onSave(reconstructedData);
  };
  
  const renderField = (field: any, index: number) => {
    const { value } = form.watch(`fields.${index}`);

    if (field.fieldName === 'lineItems') {
         if (!Array.isArray(value)) return null;
         return (
            <div className="space-y-2">
                {value.map((item: any, itemIndex: number) => (
                     <Card key={itemIndex} className="p-3 bg-muted/50">
                        <div className="space-y-2">
                        {typeof item === 'object' && item !== null ? 
                            Object.entries(item).map(([subKey, subValue]) => (
                                <div key={subKey} className="flex items-center gap-2 text-sm">
                                    <Label className="w-1/3 text-muted-foreground">{toTitleCase(subKey)}</Label>
                                    <Input defaultValue={String(subValue)} onChange={(e) => {
                                        const newFormValues = [...form.getValues().fields];
                                        ((newFormValues[index].value as any[])[itemIndex] as any)[subKey] = e.target.value;
                                        form.setValue('fields', newFormValues);
                                    }} />
                                </div>
                            ))
                            : <p>{String(item)}</p>
                        }
                        </div>
                    </Card>
                ))}
            </div>
         )
    }

    if (typeof value === 'string' && value.length > 100) {
      return <Textarea {...form.register(`fields.${index}.value`)} rows={4} />;
    }

    const fieldType = typeof value === 'number' ? 'number' : 'text';

    return <Input {...form.register(`fields.${index}.value`)} type={fieldType} step={fieldType === 'number' ? '0.01' : undefined} />;
  }

  const isPdf = invoicePreviewUrl.startsWith('data:application/pdf');

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] bg-background">
      <div className="flex-1 lg:w-1/2 border-r border-border p-4 flex items-center justify-center relative bg-muted/20">
        {isPdf ? (
            <PDFViewer file={invoicePreviewUrl} />
        ) : (
            <div className="relative w-full h-full">
                 <Image
                    src={invoicePreviewUrl}
                    alt="Uploaded invoice"
                    width={0}
                    height={0}
                    sizes="100vw"
                    className="w-full h-full object-contain"
                    data-ai-hint="invoice document"
                />
            </div>
        )}
        {highlightBox && highlightBox.length >= 4 && (
            <div
            className="absolute border-2 border-primary bg-primary/20 pointer-events-none"
            style={{
                left: `${highlightBox[0].x * 100}%`,
                top: `${highlightBox[0].y * 100}%`,
                width: `${(highlightBox[2].x - highlightBox[0].x) * 100}%`,
                height: `${(highlightBox[2].y - highlightBox[0].y) * 100}%`,
            }}
            />
        )}
      </div>
      <div className="flex-1 lg:w-1/2">
        <ScrollArea className="h-full">
          <div className="p-4 sm:p-6 lg:p-8">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                      <div className="space-y-4">
                        <div className="p-4 border rounded-md bg-muted/30">
                          <Label htmlFor="case-number" className="mb-2 block">Case Number</Label>
                          <Input
                            id="case-number"
                            value={caseNumber}
                            onChange={(e) => setCaseNumber(e.target.value)}
                            placeholder="Enter case number..."
                          />
                        </div>
                        {fields.map((field, index) => {
                          const fieldData = field;
                          return (
                            <FormItem
                              key={field.id}
                              className={cn("p-2 rounded-md transition-colors", hoveredField === field.id ? 'bg-primary/10' : '')}
                              onMouseEnter={() => {
                                if(fieldData.bbox) {
                                    setHighlightBox(fieldData.bbox as BoundingBox)
                                    setHoveredField(field.id)
                                }
                              }}
                              onMouseLeave={() => {
                                setHighlightBox(null)
                                setHoveredField(null)
                              }}
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                     <div className="flex items-center space-x-2">
                                        <div className="w-4 h-4 rounded-sm border border-muted-foreground flex items-center justify-center">
                                            {/* In a real app, this would be a real checkbox */}
                                            {fieldData.confidence > 0.9 && <div className="w-2 h-2 rounded-sm bg-primary" />}
                                        </div>
                                    </div>
                                    <FormLabel className={cn('font-medium', hoveredField === field.id && 'text-primary')}>{toTitleCase(fieldData.fieldName)}</FormLabel>
                                </div>
                                {fieldData.confidence !== undefined && (
                                  <div className="flex items-center gap-2">
                                    <CircularProgressBadge score={fieldData.confidence} className="w-8 h-8 text-xs" />
                                  </div>
                                )}
                              </div>
                              <FormControl>
                                  <div className="flex items-center gap-2">
                                    {renderField(field, index)}
                                  </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        })}
                      </div>
                    <CardFooter className="flex justify-end gap-2 mt-8">
                      <Button type="button" variant="outline" onClick={onReset}>
                        Process Another
                      </Button>
                      <Button type="submit">Save Changes</Button>
                    </CardFooter>
                  </form>
                </Form>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
