'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  placeholder?: string;
  isSubmitting?: boolean;
  onSubmit: (comment: string) => Promise<void>;
}

export function CommentDialog({
  open,
  onOpenChange,
  title = 'Add Comment',
  description = 'Add a comment or note. This will be visible to all users.',
  placeholder = 'Enter your comment here...',
  isSubmitting = false,
  onSubmit,
}: CommentDialogProps) {
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (!open) {
      setCommentText('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!commentText.trim()) return;

    await onSubmit(commentText.trim());
    setCommentText('');
  };

  const handleCancel = () => {
    setCommentText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            placeholder={placeholder}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={5}
            className="resize-none"
            disabled={isSubmitting}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!commentText.trim() || isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
