"use client";

import type { ReactNode } from "react";

export default function LudoTableLayout({
  red,
  green,
  blue,
  yellow,
  children,
}: {
  red: ReactNode;
  green: ReactNode;
  blue: ReactNode;
  yellow: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <div className="relative mx-auto w-full max-w-[1080px]">
        <div className="relative mx-auto w-full max-w-[760px]">
          {children}
        </div>

        {/* Desktop: each dice belongs to the matching board corner. */}
        <div className="pointer-events-auto absolute left-0 top-[5%] hidden w-[145px] md:block">
          {red}
        </div>
        <div className="pointer-events-auto absolute right-0 top-[5%] hidden w-[145px] md:block">
          {green}
        </div>
        <div className="pointer-events-auto absolute bottom-[5%] left-0 hidden w-[145px] md:block">
          {blue}
        </div>
        <div className="pointer-events-auto absolute bottom-[5%] right-0 hidden w-[145px] md:block">
          {yellow}
        </div>

        {/* Mobile: keep all four player dice below the board in corner order. */}
        <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
          <div>{red}</div>
          <div>{green}</div>
          <div>{blue}</div>
          <div>{yellow}</div>
        </div>
      </div>
    </div>
  );
}
