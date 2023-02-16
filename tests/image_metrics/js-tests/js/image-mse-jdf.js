// joedf modified from image-mse.js
// original is https://github.com/darosh/image-mse-js
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ImageMSE_JDF = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var ImageMSE_JDF;
(function (ImageMSE_JDF) {
    'use strict';
    function compare(image1, image2) {
        var sum = 0;
		var n_channels = 4; // assume grayscale RGBA flat array at 8 bit-depth (255)
        var p_max = 255; // max pixel value for the bit depth
        var l = image1.data.length;
        for (var i = 0; i < l; i += n_channels) {
            sum += Math.pow(image1.data[i] - image2.data[i], 2);
        }

		var pc = l / n_channels;
        var mse = sum / pc;

		var max_mse = Math.pow(p_max, 2);// * n_channels;
		var m = 1 - (mse / max_mse);

		var rmse = Math.sqrt(mse);

		// https://stats.stackexchange.com/a/413257/37910
		var rmspe = rmse / p_max;

        return {
            mse: mse,
            psnr: psnr(mse),
			// rmse: rmse,
			rmspe: rmspe,
			// metric: m,
			metric: 1 - rmspe
        };
    }
    ImageMSE_JDF.compare = compare;
    function psnr(mse, max) {
        if (max === void 0) { max = 255; }
        return 10 * log10((max * max) / mse);
    }
    function log10(value) {
        return Math.log(value) / Math.LN10;
    }
})(ImageMSE_JDF || (ImageMSE_JDF = {}));
module.exports = ImageMSE_JDF;

},{}]},{},[1])(1)
});