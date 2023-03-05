/* Image Metrics
 * ===========================================================
 * derived from image-mse.js (https://github.com/darosh/image-mse-js)
 * MIT License
 * Copyright (c) 2023 Joachim de Fourestier (Joe DF)
 */
// eslint-disable-next-line no-unused-vars
const NRMSE = {
	compare: function(image1, image2) {
		'use strict';

		if (image1.length != image2.length)
			throw "The given images have different sizes";

		const n_channels = 4; // assume grayscale RGBA flat array at 8 bit-depth (255)
		const p_max = 255; // max pixel value for the bit depth
		
		// Do sum of squared difference
		var sum = 0, l = image1.data.length;
		for (var i = 0; i < l; i += n_channels) {
			sum += Math.pow(image1.data[i] - image2.data[i], 2);
		}

		// number of pixels, each having multiple "channels",
		// or color components (e.g., R, G, B, A)...
		var pc = l / n_channels;

		// final step ("average error over all entries/pixels"),
		// to obtain MSE (Mean Squared Error)
		var mse = sum / pc;

		// Maximum possible mse value
		// var max_mse = (Math.pow(p_max - 0, 2) * pc) / pc;
		// which can be reduced to:
		// var max_mse = Math.pow(p_max, 2);

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
			inrmse: 1 - nrmse
		};
	},
	psnr: function(mse, max) {
		if (max === void 0) { max = 255; }
		return 10 * this.log10((max * max) / mse);
	},
	log10: function(value) {
		return Math.log(value) / Math.LN10;
	}
};