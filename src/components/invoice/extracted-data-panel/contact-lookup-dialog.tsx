'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ContactLookupResult } from '@/lib/crm/smartadvocate/types';

interface ContactLookupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  searchError: string;
  searchResults: ContactLookupResult[];
  onSelectContact: (contact: ContactLookupResult) => void;
  isSaving: boolean;
}

export function ContactLookupDialog({
  isOpen,
  onOpenChange,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  isSearching,
  searchError,
  searchResults,
  onSelectContact,
  isSaving,
}: ContactLookupDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Lookup Vendor in CRM</DialogTitle>
          <DialogDescription>
            Search for vendor contacts in SmartAdvocate CRM to ensure accurate vendor name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearch();
                }
              }}
              placeholder="Search by name, first name, or last name..."
              className="flex-1"
            />
            <Button
              onClick={onSearch}
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Error Message */}
          {searchError && (
            <div className="flex items-start gap-2 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{searchError}</p>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <Label className="text-sm font-medium">Select a contact:</Label>
              <div className="space-y-1">
                {searchResults.map((contact, index) => {
                  const contactName = contact.name || (contact.firstName && contact.lastName
                    ? `${contact.firstName} ${contact.lastName}`.trim()
                    : contact.firstName || contact.lastName || 'Unknown');

                  const uniqueKey = `contact-${contact.contactId || 'unknown'}-${index}-${contactName}`;

                  return (
                    <div
                      key={uniqueKey}
                      className="p-3 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onSelectContact(contact)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{contactName}</div>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {contact.contactType && (
                              <div>Type: {contact.contactType}</div>
                            )}
                            {contact.email && (
                              <div>Email: {contact.email}</div>
                            )}
                            {contact.phone && (
                              <div>Phone: {contact.phone}</div>
                            )}
                            {contact.address && (
                              <div>Address: {contact.address}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContact(contact);
                          }}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Select'
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isSearching && searchResults.length === 0 && !searchError && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Enter a search query and click search to find contacts in CRM.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
