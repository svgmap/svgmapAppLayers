/**
 * Converts USGS Intensity raster data (CovJSON) to a bitmap dataURL
 * and returns associated metadata.
 * By claude.ai w
 *
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * @param {Object} covJson - The CovJSON data object
 * @returns {Object} Object containing dataURL and metadata
 */
function covJsonToDataUrl(covJson) {
	/**
	 * Helper function to get RGB color for a given value based on the palette
	 *
	 * @param {Number} value - The MMI value
	 * @param {Array} palette - Array of color strings from CovJSON
	 * @param {Array} extent - Min and max values for the palette
	 * @returns {Object} RGB color object
	 */
	function getColorForValue(value, palette, extent) {
		// Normalize value to palette range
		const [min, max] = extent;
		const normalizedValue = Math.max(min, Math.min(max, value));

		// Calculate palette index
		const range = max - min;
		const normalizedPosition = (normalizedValue - min) / range;
		const palettePosition = normalizedPosition * (palette.length - 1);

		// Get lower and upper palette indices
		const lowerIndex = Math.floor(palettePosition);
		const upperIndex = Math.min(palette.length - 1, lowerIndex + 1);

		// Calculate interpolation factor
		const factor = palettePosition - lowerIndex;

		// Parse colors
		const lowerColor = parseRgbColor(palette[lowerIndex]);
		const upperColor = parseRgbColor(palette[upperIndex]);

		// Interpolate colors
		return {
			r: Math.round(lowerColor.r * (1 - factor) + upperColor.r * factor),
			g: Math.round(lowerColor.g * (1 - factor) + upperColor.g * factor),
			b: Math.round(lowerColor.b * (1 - factor) + upperColor.b * factor),
		};
	}

	/**
	 * Helper function to parse RGB color strings
	 *
	 * @param {String} colorStr - RGB color string (e.g., "rgb(255, 0, 0)")
	 * @returns {Object} RGB color object
	 */
	function parseRgbColor(colorStr) {
		const match = colorStr.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
		if (match) {
			return {
				r: parseInt(match[1], 10),
				g: parseInt(match[2], 10),
				b: parseInt(match[3], 10),
			};
		}
		return { r: 0, g: 0, b: 0 };
	}
	// Extract domain information
	const domain = covJson.domain;
	const xAxis = domain.axes.x;
	const yAxis = domain.axes.y;

	// Extract MMI data
	const mmiData = covJson.ranges.MMI;
	const values = mmiData.values;
	const width = mmiData.shape[1]; // x dimension
	const height = mmiData.shape[0]; // y dimension

	// Get color palette
	const palette = covJson.parameters.MMI.preferredPalette.colors;
	const colorExtent = covJson.parameters.MMI.preferredPalette.extent;

	// Create canvas for bitmap generation
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");

	// Create image data
	const imageData = ctx.createImageData(width, height);

	// Map MMI values to colors
	// 修正: y座標を反転して処理することで上下逆を修正
	for (let y = 0; y < height; y++) {
		// 反転したy座標を使用
		const invertedY = height - y - 1;

		for (let x = 0; x < width; x++) {
			// データの位置は元のデータ配列の順序に従う
			const dataIndex = invertedY * width + x;
			const value = values[dataIndex];

			// 画像データの位置は上から下の順
			const pixelIndex = y * width + x;

			// Get color based on value
			const color = getColorForValue(value, palette, colorExtent);

			// Set pixel in image data (RGBA)
			const imgDataIndex = pixelIndex * 4;
			imageData.data[imgDataIndex] = color.r; // R
			imageData.data[imgDataIndex + 1] = color.g; // G
			imageData.data[imgDataIndex + 2] = color.b; // B
			imageData.data[imgDataIndex + 3] = 255; // A (fully opaque)
		}
	}

	// Put image data on canvas
	ctx.putImageData(imageData, 0, 0);

	// Generate dataURL
	const dataUrl = canvas.toDataURL("image/png");

	// Return dataURL and metadata
	return {
		dataUrl: dataUrl,
		metadata: {
			bounds: {
				west: xAxis.start,
				east: xAxis.stop,
				south: yAxis.start,
				north: yAxis.stop,
			},
			dimensions: {
				width: width,
				height: height,
			},
			crs: domain.referencing[0].system.id,
			parameter: {
				id: covJson.parameters.MMI.observedProperty.id[0],
				label: covJson.parameters.MMI.observedProperty.label.en,
				description: covJson.parameters.MMI.description.en[0],
				colorExtent: colorExtent,
			},
		},
	};
}

/**
 * Usage example:
 *
 * // Parse the CovJSON data
 * const covJsonData = JSON.parse(covJsonString);
 *
 * // Convert to dataURL and get metadata
 * const result = covJsonToDataUrl(covJsonData);
 *
 * // Access the dataURL
 * const dataUrl = result.dataUrl;
 *
 * // Access metadata
 * const metadata = result.metadata;
 */

export{covJsonToDataUrl};