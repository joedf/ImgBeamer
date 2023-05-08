/* Image Metrics
 * ===========================================================
 * derived from image-mse.js (https://github.com/darosh/image-mse-js)
 * MIT License
 * Copyright (c) 2023 Joachim de Fourestier (Joe DF)
 */
// eslint-disable-next-line no-unused-vars
const NRMSE = {
	pixelMaxValue: 255,
	defaultTolerance: 0.01,
	compare: function(image1, image2, tolerance) {
		'use strict';

		// size check and tolerance
		if (image1.data.length != image2.data.length) {
			let dl1 = image1.data.length, dl2 = image2.data.length;
			var errmsg = "The given images have different data length ("
				+image1.width+"x"+image1.height+" vs "+image2.width+"x"+image2.height
				+") or sizes ("+dl1+" vs "+dl2+").";
			
			// get the tolerance or use default if not provided
			tolerance = (typeof tolerance !== 'undefined') ? tolerance : this.defaultTolerance;
			let relDiff = Math.abs(dl1 - dl2) / Math.max(dl1, dl2);
			if (relDiff <= tolerance) {
				// eslint-disable-next-line no-magic-numbers
				console.warn(errmsg + " Tolerance = "+tolerance+" relDiff = "+relDiff.toFixed(6));
			} else {
				throw errmsg;
			}
		}

		const n_channels = 4; // assume grayscale RGBA flat array
		// max pixel value for the bit depth. At 8 bit-depth, this is 255.
		const p_max = this.pixelMaxValue;
		
		// Do sum of squared difference
		var sum = 0, len = image1.data.length;
		for (var i = 0; i < len; i += n_channels) {
			let diff = image1.data[i] - image2.data[i];

			// check and allow for tolerance of diff image sizes
			if (isNaN(diff)) {
				if (i >= image2.data.length) {
					console.warn("Calculation loop ended early as i = "+i);
					break;
				} else {
					throw "Error: untolerated or invalid calculation!";
				}
			}

			sum += Math.pow(diff, 2);
		}

		// number of pixels, each having multiple "channels",
		// or color components (e.g., R, G, B, A)...
		var pc = len / n_channels;

		// final step ("average error over all entries/pixels"),
		// to obtain MSE (Mean Squared Error)
		var mse = sum / pc;

		// Maximum possible mse value
		// var max_mse = (Math.pow(p_max - 0, 2) * pc) / pc;
		// which can be reduced to:
		const max_mse = Math.pow(p_max, 2);

		// Normalized MSE (NMSE)
		var nmse = mse / max_mse;

		// Compute RMSE (Root MSE)
		var rmse = Math.sqrt(mse);
		
		// Normalized RMSE (NRMSE) or RMS-percentage-E (RMSPE)
		// many ways to normalize:
		// https://cirpwiki.info/wiki/Statistics#Normalization
		// https://stats.stackexchange.com/a/413257/37910
		// We just normalize by the max value possible for our RMSE
		// which is equal to Math.sqrt(max_mse);
		// which can be reduce to just: p_max
		var nrmse = rmse / p_max;

		return {
			mse: mse,
			psnr: this.psnr(mse),
			rmse: rmse,
			nrmse: nrmse,
			// "inverted" ("iNRMSE") since we want 1 = good, 0 = bad match
			inrmse: 1 - nrmse,
			nmse: nmse,
			// inverted NMSE ("iNMSE")
			inmse: 1 - nmse,
		};
	},
	psnr: function(mse, max) {
		if (max === void 0) { max = this.pixelMaxValue; }
		// eslint-disable-next-line no-magic-numbers
		return 10 * this.log10((max * max) / mse);
	},
	log10: function(value) {
		return Math.log(value) / Math.LN10;
	}
};