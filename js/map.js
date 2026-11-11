/* Peta skematik (SVG) — bukan peta skala sebenarnya. Dipakai di dashboard & admin. */
(function () {
  'use strict';
  CC.mapSVG = function () {
    return `<svg viewBox="0 0 800 540" preserveAspectRatio="none" aria-hidden="true">
      <rect width="800" height="540" fill="#ece8dc"/>
      <path d="M0 0H800V26C700 40 620 14 520 28S300 44 200 24 60 36 0 22Z" fill="#cfe0ee"/>
      <path d="M0 210C120 190 190 250 300 232S470 190 560 230 720 270 800 244" stroke="#cfe0ee" stroke-width="14" fill="none" stroke-linecap="round"/>
      <g fill="#d5e5c8">
        <rect x="430" y="100" width="100" height="62" rx="14"/>
        <rect x="70" y="300" width="94" height="90" rx="16"/>
        <rect x="610" y="244" width="90" height="56" rx="14"/>
      </g>
      <g fill="#e2dccd">
        <rect x="150" y="90" width="110" height="60" rx="6"/><rect x="560" y="300" width="100" height="70" rx="6"/>
        <rect x="190" y="420" width="120" height="70" rx="6"/><rect x="620" y="420" width="120" height="60" rx="6"/>
        <rect x="300" y="300" width="90" height="60" rx="6"/><rect x="520" y="400" width="70" height="70" rx="6"/>
      </g>
      <g stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M0 330H800"/><path d="M0 150H800"/><path d="M300 0V540"/><path d="M560 0V540"/>
        <path d="M80 540L330 200 420 0"/><path d="M800 120 620 330 520 540"/>
      </g>
      <g stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round">
        <path d="M0 450H800"/><path d="M0 70H800"/><path d="M150 0V540"/><path d="M700 0V540"/><path d="M430 0V540"/>
      </g>
      <path d="M40 500C200 460 330 410 520 330S720 250 800 230" stroke="#9aa7b8" stroke-width="3" stroke-dasharray="3 9" stroke-linecap="round" fill="none"/>
    </svg>`;
  };
})();
