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
    <div className="mx-auto grid w-full max-w-[1120px] grid-cols-2 items-center gap-3 md:grid-cols-[150px_minmax(420px,760px)_150px] md:grid-rows-[auto_minmax(0,1fr)_auto] md:gap-x-4 md:gap-y-3">
      <div className="order-1 md:col-start-1 md:row-start-1 md:order-none">{red}</div>
      <div className="order-2 md:col-start-3 md:row-start-1 md:order-none">{green}</div>

      <div className="order-5 col-span-2 md:col-start-2 md:row-start-1 md:row-span-3 md:order-none">
        {children}
      </div>

      <div className="order-3 md:col-start-1 md:row-start-3 md:order-none">{blue}</div>
      <div className="order-4 md:col-start-3 md:row-start-3 md:order-none">{yellow}</div>
    </div>
  );
}
