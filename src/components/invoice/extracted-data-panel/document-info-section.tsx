'use client';

import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface DocumentInfoSectionProps {
  comment: string;
}

export function DocumentInfoSection({ comment }: DocumentInfoSectionProps) {
  const hasComment = comment.trim().length > 0;

  return (
    <div className="rounded-md border">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="document-info" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Document Info
              </Label>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Comment
              </Label>
              <div className="p-2.5 rounded-lg border bg-muted/30">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {hasComment ? comment : <span className="text-muted-foreground italic">No comment</span>}
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
