"use client";

import { useId, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

// The dashboard's toggle, in the two sizes it comes in. The same markup had been
// copied into four settings panels, each one a button wearing role="switch" —
// announced correctly, but silent to Space, with no focus ring and no disabled
// treatment. The primitive supplies all three.
//
// `tone` is the meaning of "on": a notification being enabled is a good thing,
// an extension being blocked is a restriction, and they should not look alike.
export function SettingSwitch({
  id,
  checked,
  onCheckedChange,
  disabled,
  size = "default",
  tone = "indigo",
  ariaLabel,
}: {
  // Pair with a <label htmlFor>: a button is a labelable element, so the text
  // beside the switch stays part of its hit area.
  id?: string;
  checked: boolean;
  onCheckedChange: () => void;
  disabled?: boolean;
  size?: "default" | "md" | "sm";
  tone?: "indigo" | "red";
  ariaLabel?: string;
}) {
  // The track sizes are written twice because the primitive states its own
  // through a data attribute, which outranks a bare utility class.
  const track = {
    sm: "h-4 w-7 data-[size=default]:h-4 data-[size=default]:w-7",
    md: "h-5 w-9 data-[size=default]:h-5 data-[size=default]:w-9",
    default: "h-6 w-11 data-[size=default]:h-6 data-[size=default]:w-11",
  }[size];
  const thumb = {
    sm: "size-3 group-data-[size=default]/switch:size-3 data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0.5",
    md: "size-3.5 group-data-[size=default]/switch:size-3.5 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-1",
    default:
      "size-5 group-data-[size=default]/switch:size-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5",
  }[size];

  return (
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`shadow-none disabled:opacity-60 data-[state=unchecked]:bg-zinc-700 dark:data-[state=unchecked]:bg-zinc-700 ${track} ${
        tone === "red"
          ? "data-[state=checked]:bg-red-500"
          : "data-[state=checked]:bg-indigo-600"
      }`}
      thumbClassName={`bg-white shadow dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-white ${thumb}`}
    />
  );
}

// A compact, whole-row toggle: the switch sits right next to its label (w-fit),
// so it never stretches across the screen. The label is a real <label> pointing
// at the switch — a button is labelable, so the text stays part of the hit area
// now that the row is no longer one big button.
export function ToggleRow({
  on,
  onFlip,
  children,
}: {
  on: boolean;
  onFlip: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex w-fit items-center gap-3 text-left">
      <SettingSwitch id={id} checked={on} onCheckedChange={onFlip} />
      <label htmlFor={id} className="cursor-pointer">
        {children}
      </label>
    </div>
  );
}
