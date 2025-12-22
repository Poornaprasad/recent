"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, Palette, Save, KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function SettingsPage() {
  const { user, setUser, token } = useAuthStore();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [name, setName] = React.useState(user?.name || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [mounted, setMounted] = React.useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state with user when it changes
  React.useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const darkMode = theme === 'dark';

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const names = name.split(" ");
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase();
  };

  const handleProfileSave = async () => {
    if (user) {
      setSavingProfile(true);
      try {
        setUser({ ...user, name, email });
        toast({ title: "Profile Updated", description: "Your profile information has been saved." });
      } finally {
        setSavingProfile(false);
      }
    }
  };

  const handleChangePassword = async () => {
    if (!token) {
      toast({ title: "Error", description: "You must be logged in to change your password.", variant: "destructive" });
      return;
    }

    // Validate passwords
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Error", description: "All password fields are required.", variant: "destructive" });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: "Error", description: "New password must be at least 6 characters long.", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New password and confirm password do not match.", variant: "destructive" });
      return;
    }

    if (currentPassword === newPassword) {
      toast({ title: "Error", description: "New password must be different from current password.", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: "Password Changed", description: "Your password has been updated successfully." });
        setChangePasswordOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        throw new Error(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password.",
        variant: "destructive"
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading settings"
    >
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" aria-hidden="true" />
        <span className="sr-only">Loading settings page...</span>
        <p className="mt-4 text-muted-foreground">Loading settings...</p>
      </div>
    </div>
  );

  return (
    <main className="flex-1 space-y-4 p-4 md:p-8 pt-6" aria-labelledby="settings-heading">
      <div className="flex items-center justify-between space-y-2">
        <h1 id="settings-heading" className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>
      <p className="text-muted-foreground" id="settings-description">
        Manage your account settings and preferences.
      </p>

      <Tabs defaultValue="profile" className="w-full max-w-3xl" aria-label="Settings sections">
        <TabsList className="grid w-full grid-cols-3 mb-6" aria-label="Settings tabs">
          <TabsTrigger value="profile" aria-controls="profile-tab">
            <User className="mr-1.5 h-4 w-4 hidden sm:inline-block" aria-hidden="true" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="appearance" aria-controls="appearance-tab">
            <Palette className="mr-1.5 h-4 w-4 hidden sm:inline-block" aria-hidden="true" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="security" aria-controls="security-tab">
            <Shield className="mr-1.5 h-4 w-4 hidden sm:inline-block" aria-hidden="true" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" id="profile-tab" role="tabpanel" aria-labelledby="profile-trigger">
          <Card>
            <CardHeader>
              <CardTitle id="profile-title">Profile Information</CardTitle>
              <CardDescription id="profile-description">Update your personal details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6" aria-describedby="profile-description">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20" aria-label={`Avatar for ${user.name}`}>
                  <AvatarFallback className="text-2xl" aria-hidden="true">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role?.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-name">Full Name</Label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-describedby="name-hint"
                  autoComplete="name"
                />
                <p id="name-hint" className="sr-only">Enter your full name as you would like it displayed</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-email">Email Address</Label>
                <Input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby="email-hint"
                  autoComplete="email"
                />
                <p id="email-hint" className="sr-only">Enter a valid email address</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-role">Role</Label>
                <Input
                  id="settings-role"
                  value={user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ') : ''}
                  disabled
                  className="capitalize"
                  aria-describedby="role-hint"
                  aria-readonly="true"
                />
                <p id="role-hint" className="sr-only">Your role is assigned by an administrator and cannot be changed here</p>
              </div>

              <Button
                onClick={handleProfileSave}
                disabled={savingProfile}
                aria-busy={savingProfile}
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span>Save Profile</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" id="appearance-tab" role="tabpanel" aria-labelledby="appearance-trigger">
          <Card>
            <CardHeader>
              <CardTitle id="appearance-title">Appearance Settings</CardTitle>
              <CardDescription id="appearance-description">Customize the look and feel of the application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6" aria-describedby="appearance-description">
              <fieldset className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode" className="font-medium cursor-pointer">
                    Dark Mode
                  </Label>
                  <p id="dark-mode-description" className="text-sm text-muted-foreground">
                    Enable dark theme for improved visibility in low light.
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={mounted && darkMode}
                  onCheckedChange={(checked) => {
                    setTheme(checked ? 'dark' : 'light');
                    toast({
                      title: "Theme Updated",
                      description: checked ? "Dark mode enabled" : "Light mode enabled"
                    });
                  }}
                  aria-describedby="dark-mode-description"
                  disabled={!mounted}
                />
              </fieldset>
              <p className="text-sm text-muted-foreground">
                Theme changes are applied immediately. More customization options will be available in future updates.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" id="security-tab" role="tabpanel" aria-labelledby="security-trigger">
          <Card>
            <CardHeader>
              <CardTitle id="security-title">Security Settings</CardTitle>
              <CardDescription id="security-description">Manage your account password and security options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6" aria-describedby="security-description">
              <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" aria-haspopup="dialog">
                    <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent aria-labelledby="change-password-title" aria-describedby="change-password-description">
                  <DialogHeader>
                    <DialogTitle id="change-password-title">Change Password</DialogTitle>
                    <DialogDescription id="change-password-description">
                      Enter your current password and choose a new password for your account.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}
                    className="space-y-4 py-4"
                    aria-label="Change password form"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="current-password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          autoComplete="current-password"
                          aria-describedby="current-password-hint"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                          aria-pressed={showCurrentPassword}
                        >
                          {showCurrentPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </Button>
                      </div>
                      <p id="current-password-hint" className="sr-only">Enter your current account password</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min. 6 characters)"
                          autoComplete="new-password"
                          aria-describedby="new-password-hint"
                          minLength={6}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                          aria-pressed={showNewPassword}
                        >
                          {showNewPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </Button>
                      </div>
                      <p id="new-password-hint" className="text-xs text-muted-foreground">
                        Password must be at least 6 characters long
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          autoComplete="new-password"
                          aria-describedby="confirm-password-hint"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          aria-pressed={showConfirmPassword}
                        >
                          {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </Button>
                      </div>
                      <p id="confirm-password-hint" className="sr-only">Re-enter your new password to confirm</p>
                    </div>
                  </form>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setChangePasswordOpen(false)}
                      disabled={changingPassword}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      aria-busy={changingPassword}
                    >
                      {changingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          <span>Changing...</span>
                        </>
                      ) : (
                        "Change Password"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <fieldset className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="2fa" className="font-medium cursor-pointer">
                    Two-Factor Authentication (2FA)
                  </Label>
                  <p id="2fa-description" className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account.
                  </p>
                </div>
                <Switch
                  id="2fa"
                  aria-describedby="2fa-description 2fa-status"
                  disabled
                  onCheckedChange={() => toast({title: "Feature not implemented", description: "2FA setup will be available soon."})}
                />
                <span id="2fa-status" className="sr-only">Two-factor authentication is currently unavailable</span>
              </fieldset>

              <p className="text-sm text-muted-foreground">
                View active sessions and manage authorized devices in upcoming releases.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Live region for announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {changingPassword && "Changing password, please wait..."}
        {savingProfile && "Saving profile, please wait..."}
      </div>
    </main>
  );
}
