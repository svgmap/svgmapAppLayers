// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { initializeLayer, shutdownLayer } from './core.js';

(() => {
  if (window.document.readyState === 'complete') {
    initializeLayer();
  } else {
    window.addEventListener('load', initializeLayer, { once: true });
  }
  window.addEventListener('beforeunload', shutdownLayer, { once: true });
})();
