"use client";

import * as React from "react";
import {
  Edit2Icon,
  Loader2Icon,
  PhoneIcon,
  UserIcon,
  MailIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { TenantProfile } from "../types/portal.types";

type TenantProfileCardProps = {
  profile: TenantProfile;
  onUpdatePhone: (phone: string | null) => Promise<void>;
  isUpdatingPhone: boolean;
};

const PHONE_REGEX = /^[0-9+() -]+$/;

export function TenantProfileCard({
  profile,
  onUpdatePhone,
  isUpdatingPhone,
}: TenantProfileCardProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [phone, setPhone] = React.useState(profile.phone ?? "");
  const [error, setError] = React.useState<string | null>(null);

  const startEditing = () => {
    setPhone(profile.phone ?? "");
    setError(null);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();

    if (trimmed.length > 0) {
      if (!PHONE_REGEX.test(trimmed)) {
        setError(
          "Phone number can only contain digits, +, -, (, ), and spaces.",
        );
        return;
      }
      if (trimmed.length > 20) {
        setError("Phone number must not exceed 20 characters.");
        return;
      }
    }

    setError(null);
    try {
      await onUpdatePhone(trimmed.length > 0 ? trimmed : null);
      setIsEditing(false);
    } catch {
      // Container displays toast
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-title-2 text-label">My Profile</CardTitle>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startEditing}
            className="text-tint hover:text-tint h-8 gap-1.5"
          >
            <Edit2Icon className="h-3.5 w-3.5" />
            <span>Edit Phone</span>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-tint-fill text-tint flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <UserIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-footnote text-label-2">Name</p>
            <p className="text-body text-label font-medium">{profile.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-inset text-label-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <MailIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-footnote text-label-2">Email</p>
            <p className="text-body text-label">{profile.email}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="bg-inset text-label-2 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <PhoneIcon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-footnote text-label-2">Phone</p>
            {isEditing ? (
              <form onSubmit={handleSubmit} className="mt-1 space-y-2">
                <Input
                  type="tel"
                  placeholder="+60 12-345 6789"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isUpdatingPhone}
                  aria-invalid={Boolean(error)}
                  className="max-w-xs"
                />
                {error && <p className="text-footnote text-red">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-tint text-on-tint hover:bg-tint/90 h-8"
                    disabled={isUpdatingPhone}
                  >
                    {isUpdatingPhone && (
                      <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setPhone(profile.phone ?? "");
                      setError(null);
                      setIsEditing(false);
                    }}
                    disabled={isUpdatingPhone}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-body text-label">
                {profile.phone || (
                  <span className="text-label-2 italic">Not provided</span>
                )}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
