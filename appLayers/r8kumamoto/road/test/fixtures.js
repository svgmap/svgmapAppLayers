// License: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export function lineFeature(coordinates, properties = {}) {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties
  };
}

export function featureCollection(features) {
  return { type: "FeatureCollection", features };
}
