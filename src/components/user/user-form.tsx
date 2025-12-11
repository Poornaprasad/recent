
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
import { useEffect, useMemo } from 'react';
import { UserRole } from '@/lib/core/auth/rbac.types';

const userFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  role: z.enum(['admin', 'director', 'manager', 'senior_accountant', 'ny_accountant', 'ca_accountant']),
  status: z.enum(['Active', 'Inactive', 'Invited']),
  assignedStates: z.array(z.string()).optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: UserFormData | Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => void;
  user: User | null;
  isSubmitting?: boolean;
}

export function UserForm({ isOpen, onOpenChange, onSubmit, user, isSubmitting = false }: UserFormProps) {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
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
        role: user.role as any,
        status: user.status as any,
        assignedStates: assignedStates,
      });
    } else {
      form.reset({
        name: '',
        email: '',
        role: 'ca_accountant',
        status: 'Invited',
        assignedStates: [],
      });
    }
  }, [user, form, isOpen]);

  const handleFormSubmit = (data: UserFormData) => {
    // Convert assignedStates array to JSON string for storage
    const submitData = {
      ...data,
      assignedStates: data.assignedStates && data.assignedStates.length > 0 
        ? JSON.stringify(data.assignedStates) 
        : undefined,
    };
    
    if (user) {
        onSubmit({ ...user, ...submitData });
    } else {
        onSubmit(submitData as any);
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
