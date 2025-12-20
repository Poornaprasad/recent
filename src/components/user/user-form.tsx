
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
import { Eye, EyeOff } from 'lucide-react';

// Base schema - password is optional
const baseUserFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional(),
  role: z.enum(['admin', 'director', 'manager', 'senior_accountant', 'ny_accountant', 'ca_accountant']),
  status: z.enum(['Active', 'Inactive', 'Invited']),
  assignedStates: z.array(z.string()).optional(),
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
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'ca_accountant',
      status: 'Invited',
      assignedStates: [],
    },
  });

  const selectedRole = form.watch('role');
  const isAccountantRole = useMemo(() => {
    return [
      UserRole.SENIOR_ACCOUNTANT,
      UserRole.NY_ACCOUNTANT,
      UserRole.CA_ACCOUNTANT,
    ].includes(selectedRole as UserRole);
  }, [selectedRole]);

  // Parse assignedStates from JSON string if it exists
  useEffect(() => {
    if (user) {
      const assignedStates = user.assignedStates 
        ? (typeof user.assignedStates === 'string' ? JSON.parse(user.assignedStates) : user.assignedStates)
        : [];
      form.reset({
        name: user.name,
        email: user.email,
        password: '', // Don't show password when editing
        role: user.role as any,
        status: user.status as any,
        assignedStates: assignedStates,
      });
    } else {
      form.reset({
        name: '',
        email: '',
        password: '',
        role: 'ca_accountant',
        status: 'Invited',
        assignedStates: [],
      });
    }
    setShowPassword(false);
  }, [user, form, isOpen]);

  const handleFormSubmit = (data: UserFormData) => {
    // Validate password is required for new users
    if (!user && (!data.password || (typeof data.password === 'string' && data.password.trim() === ''))) {
      form.setError('password', {
        type: 'manual',
        message: 'Password is required for new users.',
      });
      return;
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
      assignedStates: data.assignedStates && data.assignedStates.length > 0 
        ? JSON.stringify(data.assignedStates) 
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
      <DialogContent className="sm:max-w-[425px]">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <FormField
                control={form.control}
                name="assignedStates"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Additional State Access</FormLabel>
                      <FormDescription>
                        {selectedRole === 'ny_accountant' 
                          ? 'NY Accountant has access to NY by default. Select additional states if needed.'
                          : selectedRole === 'ca_accountant'
                          ? 'CA Accountant has access to CA by default. Select additional states if needed.'
                          : 'Senior Accountant has access to all states by default. Select specific states to limit access.'}
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
