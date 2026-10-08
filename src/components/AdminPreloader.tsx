/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import VeloceLogo from './VeloceLogo';

export default function AdminPreloader() {
  return (
    <div
      aria-label="Loading"
      className="fixed inset-0 z-[99999] bg-slate-950 flex items-center justify-center select-none"
    >
      <div className="relative flex items-center justify-center">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute w-40 h-40 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none animate-pulse" />

        {/* Clean Logo with Smooth Pulse Animation */}
        <div className="relative z-10 animate-pulse transition-transform duration-700 ease-in-out">
          <VeloceLogo size="lg" light={true} />
        </div>
      </div>
    </div>
  );
}
