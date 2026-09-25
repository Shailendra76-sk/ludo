"use client";

import type { ReactNode } from "react";

export default function LudoTableLayout({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  children,
}: {
  topLeft: ReactNode;
  topRight: ReactNode;
  bottomLeft: ReactNode;
  bottomRight: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-3 md:grid-cols-[125px_minmax(420px,760px)_125px] md:grid-rows-[auto_minmax(0,1fr)_auto] md:items-center md:gap-x-4 md:gap-y-3">
      <div className="md:col-start-1 md:row-start-1">{topLeft}</div>
      <div className="md:col-start-3 md:row-start-1">{topRight}</div>

      <div className="order-first md:col-start-2 md:row-start-1 md:row-span-3 md:order-none">
        {children}
      </div>

      <div className="md:col-start-1 md:row-start-3">{bottomLeft}</div>
      <div className="md:col-start-3 md:row-start-3">{bottomRight}</div>
    </div>
  );
}
