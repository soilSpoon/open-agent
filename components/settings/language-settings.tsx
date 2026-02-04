"use client";

import { useId } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/lib/settings-context";

export function LanguageSettings() {
  const { language, setLanguage } = useSettings();
  const id = useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language Preferences</CardTitle>
        <CardDescription>
          Choose the language for AI-generated content and interface.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={id}>AI Output Language</Label>
          <Select
            value={language}
            onValueChange={(value) => {
              if (value === "en" || value === "ko") {
                setLanguage(value);
              }
            }}
          >
            <SelectTrigger id={id} className="w-[200px]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ko">한국어 (Korean)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            This setting controls the language used by the AI when generating or
            fixing OpenSpec artifacts.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
