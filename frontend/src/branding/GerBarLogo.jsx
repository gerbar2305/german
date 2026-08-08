import React from "react";

export default function GerBarLogo({ compact = false }) {
  return (
    <div className={`gerbar-logo ${compact ? "compact" : ""}`}>
      <div className="gerbar-logo-mark" aria-hidden="true">
        <span className="gerbar-logo-road" />
        <span className="gerbar-logo-box box-a" />
        <span className="gerbar-logo-box box-b" />
        <span className="gerbar-logo-cab" />
        <span className="gerbar-logo-wheel wheel-a" />
        <span className="gerbar-logo-wheel wheel-b" />
      </div>

      <div className="gerbar-logo-copy">
        <strong>GERBAR</strong>
        <span>LOAD PLANNER</span>
      </div>
    </div>
  );
}
