
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User } from '@/lib/db/schema';
import { useEffect, useMemo, useState } from 'react';
import { UserRole } from '@/lib/core/auth/rbac.types';
import { Eye, EyeOff, AlertCircle, Unlock, Lock } from 'lucide-react';
import { useAuthStore } from '@/hooks/use-auth-store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/utils';

// Base schema - password is optional
const baseUserFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional(),
  role: z.enum(['admin', 'director', 'manager', 'senior_accountant', 'ny_accountant', 'ca_accountant']),
  status: z.enum(['Active', 'Inactive', 'Invited']),
  assignedStates: z.array(z.string()).optional(),
  primaryState: z.string().optional(),
  secondaryState: z.string().optional(),
  overrideStateOrder: z.boolean().optional(),
});

// Schema for new users - password is required
const newUserFormSchema = baseUserFormSchema.extend({
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

// Use base schema (password optional) - we'll validate password requirement in component
const userFormSchema = baseUserFormSchema;

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'password'> & { id?: string; password?: string | null }) => void;
  user: User | null;
  isSubmitting?: boolean;
}

export function UserForm({ isOpen, onOpenChange, onSubmit, user, isSubmitting = false }: UserFormProps) {
  const { user: currentUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [overrideStateOrder, setOverrideStateOrder] = useState(false);
  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'ca_accountant',
      status: 'Invited',
      assignedStates: [],
      primaryState: undefined,
      secondaryState: undefined,
      overrideStateOrder: false,
    },
  });

  const selectedRole = form.watch('role');
  const primaryState = form.watch('primaryState');
  const secondaryState = form.watch('secondaryState');
  
  const isAccountantRole = useMemo(() => {
    return [
      UserRole.SENIOR_ACCOUNTANT,
      UserRole.NY_ACCOUNTANT,
      UserRole.CA_ACCOUNTANT,
    ].includes(selectedRole as UserRole);
  }, [selectedRole]);

  const isNYAccountant = selectedRole === 'ny_accountant';
  const isCAAccountant = selectedRole === 'ca_accountant';
  const canOverride = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.DIRECTOR;

  // Determine primary and secondary states based on role
  const primaryStateOption = isNYAccountant ? 'NY' : isCAAccountant ? 'CA' : null;
  const secondaryStateOption = isNYAccountant ? 'CA' : isCAAccountant ? 'NY' : null;

  // Check if primary state is selected (required for NY/CA accountants)
  const currentPrimaryState = primaryState || primaryStateOption;
  const isPrimaryStateSelected = currentPrimaryState === primaryStateOption;
  const canSelectSecondary = overrideStateOrder || isPrimaryStateSelected;

  // Parse assignedStates from JSON string if it exists
  useEffect(() => {
    if (user) {
      const assignedStates = user.assignedStates 
        ? (typeof user.assignedStates === 'string' ? JSON.parse(user.assignedStates) : user.assignedStates)
        : [];
      
      // Extract primary and secondary states from array
      // First state is primary, second is secondary (if exists)
      const primary = assignedStates[0] || (user.role === 'ny_accountant' ? 'NY' : user.role === 'ca_accountant' ? 'CA' : undefined);
      const secondary = assignedStates[1] || undefined;
      
      form.reset({
        name: user.name,
        email: user.email,
        password: '', // Don't show password when editing
        role: user.role as any,
        status: user.status as any,
        assignedStates: assignedStates,
        primaryState: primary,
        secondaryState: secondary,
        overrideStateOrder: false,
      });
    } else {
      form.reset({
        name: '',
        email: '',
        password: '',
        role: 'ca_accountant',
        status: 'Invited',
        assignedStates: [],
        primaryState: undefined,
        secondaryState: undefined,
        overrideStateOrder: false,
      });
    }
    setShowPassword(false);
    setOverrideStateOrder(false);
  }, [user, form, isOpen]);

  // Auto-select primary state when role changes
  useEffect(() => {
    if ((isNYAccountant || isCAAccountant) && !primaryState && !user) {
      form.setValue('primaryState', primaryStateOption || undefined);
    }
  }, [selectedRole, isNYAccountant, isCAAccountant, primaryStateOption, form, user]);

  // Update assignedStates when primary/secondary states change
  useEffect(() => {
    if (isNYAccountant || isCAAccountant) {
      const states: string[] = [];
      const currentPrimary = primaryState || primaryStateOption;
      if (currentPrimary) states.push(currentPrimary);
      if (secondaryState && (canSelectSecondary || overrideStateOrder)) {
        states.push(secondaryState);
      }
      form.setValue('assignedStates', states);
    }
  }, [primaryState, secondaryState, canSelectSecondary, overrideStateOrder, isNYAccountant, isCAAccountant, primaryStateOption, form]);

  const handleFormSubmit = (data: UserFormData) => {
    // Validate password is required for new users
    if (!user && (!data.password || (typeof data.password === 'string' && data.password.trim() === ''))) {
      form.setError('password', {
        type: 'manual',
        message: 'Password is required for new users.',
      });
      return;
    }

    // For NY/CA accountants, validate primary state is selected
    const finalPrimaryState = primaryState || primaryStateOption;
    if ((isNYAccountant || isCAAccountant) && !finalPrimaryState && !overrideStateOrder) {
      form.setError('primaryState', {
        type: 'manual',
        message: `Primary state (${primaryStateOption}) must be selected first.`,
      });
      return;
    }

    // Build assignedStates array: [primary, secondary] in order
    let assignedStatesArray: string[] = [];
    if (isNYAccountant || isCAAccountant) {
      if (finalPrimaryState) assignedStatesArray.push(finalPrimaryState);
      if (secondaryState && (canSelectSecondary || overrideStateOrder)) {
        assignedStatesArray.push(secondaryState);
      }
    } else if (data.assignedStates) {
      assignedStatesArray = data.assignedStates;
    }

    // Convert assignedStates array to JSON string for storage
    const passwordValue = data.password && typeof data.password === 'string' && data.password.trim() !== '' 
      ? data.password 
      : null;
    
    const submitData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'password'> & { id?: string; password?: string | null } = {
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status,
      assignedStates: assignedStatesArray.length > 0 
        ? JSON.stringify(assignedStatesArray) 
        : null,
      // Only include password if it's provided (for new users)
      ...(passwordValue ? { password: passwordValue } : {}),
    };
    
    if (user) {
        onSubmit({ ...user, ...submitData });
    } else {
        onSubmit(submitData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            {user ? "Update the user's details below." : "Enter the details for the new user."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!user && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="•••••••••••"
                          {...field}
                          autoComplete="new-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Password must be at least 6 characters long.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="director">Director</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="senior_accountant">Senior Accountant</SelectItem>
                        <SelectItem value="ny_accountant">NY Accountant</SelectItem>
                        <SelectItem value="ca_accountant">CA Accountant</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                            <SelectItem value="Invited">Invited</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            {isAccountantRole && (
              <div className="space-y-4">
                {isNYAccountant || isCAAccountant ? (
                  <>
                    {/* Primary State Selection */}
                    <FormField
                      control={form.control}
                      name="primaryState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base flex items-center gap-2">
                            Primary State <span className="text-destructive">*</span>
                            {primaryState === primaryStateOption && (
                              <Badge variant="success" className="text-xs">Required</Badge>
                            )}
                          </FormLabel>
                          <FormDescription>
                            {isNYAccountant 
                              ? 'NY Accountant must have NY as primary state. Complete NY access before adding CA.'
                              : 'CA Accountant must have CA as primary state. Complete CA access before adding NY.'}
                          </FormDescription>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || primaryStateOption || ''}
                            disabled={!overrideStateOrder}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={`Select ${primaryStateOption} as primary state`} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {primaryStateOption && (
                                <SelectItem value={primaryStateOption}>
                                  {primaryStateOption} (Primary - Required)
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {isPrimaryStateSelected && (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <AlertCircle className="h-4 w-4" />
                              <span>Primary state selected. You can now add secondary state.</span>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Override Button for Admins/Directors */}
                    {canOverride && (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <Button
                          type="button"
                          variant={overrideStateOrder ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setOverrideStateOrder(!overrideStateOrder);
                            form.setValue('overrideStateOrder', !overrideStateOrder);
                          }}
                          className="flex items-center gap-2"
                        >
                          {overrideStateOrder ? (
                            <>
                              <Unlock className="h-4 w-4" />
                              Override Active
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4" />
                              Override State Order
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground flex-1">
                          {overrideStateOrder 
                            ? 'Override enabled: You can select states in any order.'
                            : 'Enable to bypass primary/secondary state order requirement.'}
                        </p>
                      </div>
                    )}

                    {/* Secondary State Selection */}
                    <FormField
                      control={form.control}
                      name="secondaryState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base flex items-center gap-2">
                            Secondary State
                            {secondaryState && (
                              <Badge variant="outline" className="text-xs">Optional</Badge>
                            )}
                          </FormLabel>
                          <FormDescription>
                            {isNYAccountant
                              ? 'Add CA as secondary state after NY is completed.'
                              : 'Add NY as secondary state after CA is completed.'}
                          </FormDescription>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value === 'none' ? undefined : value);
                            }} 
                            value={field.value || 'none'}
                            disabled={!canSelectSecondary}
                          >
                            <FormControl>
                              <SelectTrigger className={cn(
                                !canSelectSecondary && "opacity-50 cursor-not-allowed"
                              )}>
                                <SelectValue placeholder={
                                  !canSelectSecondary 
                                    ? `Select ${primaryStateOption} first`
                                    : `Select ${secondaryStateOption} as secondary state`
                                } />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {secondaryStateOption && (
                                <SelectItem value={secondaryStateOption}>
                                  {secondaryStateOption} (Secondary)
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {!canSelectSecondary && !overrideStateOrder && (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                You must select {primaryStateOption} as primary state first.
                              </AlertDescription>
                            </Alert>
                          )}
                          {secondaryState && (
                            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                              <AlertCircle className="h-4 w-4" />
                              <span>Secondary state added. User will have access to both states.</span>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* State Summary */}
                    {(currentPrimaryState || secondaryState) && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-semibold mb-2">State Access Summary:</p>
                        <div className="flex flex-wrap gap-2">
                          {currentPrimaryState && (
                            <Badge variant="default" className="gap-1">
                              {currentPrimaryState} (Primary)
                            </Badge>
                          )}
                          {secondaryState && (
                            <Badge variant="secondary" className="gap-1">
                              {secondaryState} (Secondary)
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Senior Accountant - show all states as checkboxes
                  <FormField
                    control={form.control}
                    name="assignedStates"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">State Access</FormLabel>
                          <FormDescription>
                            Senior Accountant has access to all states by default. Select specific states to limit access.
                          </FormDescription>
                        </div>
                        {['CA', 'NY'].map((state) => (
                          <FormField
                            key={state}
                            control={form.control}
                            name="assignedStates"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={state}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(state)}
                                      onCheckedChange={(checked) => {
                                        const currentValues = field.value || [];
                                        return checked
                                          ? field.onChange([...currentValues, state])
                                          : field.onChange(
                                              currentValues.filter((value) => value !== state)
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {state}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                    Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : user ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
