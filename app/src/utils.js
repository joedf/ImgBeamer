/* globals
 G_DEBUG
 NRMSE
 ImageMSSSIM
 G_GUI_Controller
 UTIF
 G_AUTO_PREVIEW_LIMIT
 G_IMG_METRIC_ENABLED
 G_APP_NAME
 */

/* exported GetOptimalBoxWidth */

/**
 * Used for display, for number.toFixed() rounding.
 * @namespace G_MATH_TOFIXED
 */
const G_MATH_TOFIXED = {
	/**
	 * @type {number}
	 * @description The minimum number of decimal digits.
	 */
	MIN: 1,
	/** The short or standard number of decimal digits. */
	SHORT: 2,
	/** The maximum or "longest" number of decimal digits. */
	LONG: 4
};

/**
 * Calculated the size to use for each drawing box/stage.
 * Edit the values in the functions to change the box sizing.
 * @returns The size to use.
 */
function GetOptimalBoxWidth(){
	// Values used to calculate the size of each box/stage
	var boxesPerPageWidth = 5;
	// count-in the width of the borders of the boxes
	var boxBorderW = 2 * (parseInt($('.box:first').css('border-width')) || 1);
	var scrollBarW = 15; // scroll bar width
	var boxSizeMax = 300; //max width for the boxes

	// make sure to have an integer value to prevent slight sizing differences between each box
	var calculatedBoxSize = Math.ceil(Math.max(
		(document.body.clientWidth / boxesPerPageWidth) - boxBorderW - scrollBarW,
		boxSizeMax));
	
	return calculatedBoxSize;
}

/**
 * Various utility and helper functions
 * @namespace Utils
 */
const Utils = {
	/**
	 * Makes a new stage 'box' with a layer added, and some settings
	 * @param {Element} parentContainer the DOM element of the parent container in which to add a stage 'box'.
	 * @param {*} w the width of the stage
	 * @param {*} h the height of the stage
	 * @returns the drawing stage.
	 */
	newStageTemplate: function(parentContainer, w, h) {
		var $e = $('<div/>').addClass('box').appendTo(parentContainer);
		var stage = new Konva.Stage({
			container: $e.get(0),
			width: w,
			height: h
		});

		// then create layer and to stage
		var layer = new Konva.Layer({
			listening: false // faster render
		});

		// add and push
		stage.add(layer);

		// turn off by default antialiasing/smoothing
		// important do that AFTER you added layer to a stage
		// https://github.com/konvajs/konva/issues/306#issuecomment-351263036
		layer.imageSmoothingEnabled(false);

		return stage;
	},

	/**
	 * Initiates the image resource load with a callback once the image is loaded.
	 * @param {string} url The url pointing to the image to load.
	 * @param {function} callback The callback function to call/run once the image is loaded.
	 * @param {boolean} _allowRetryAsUTIF Used internally to prevent a recursive retry loop with the UTIF decoder.
	 */
	loadImage: function(url, callback, _allowRetryAsUTIF = true) {
		var imageObj = new Image();
		imageObj.onload = callback;

		imageObj.onerror = function(e){
			// eslint-disable-next-line no-magic-numbers
			if (_allowRetryAsUTIF && e.target.src.substring(0,22) == "data:image/tiff;base64") {
				console.warn("ERROR: could not load the given TIFF image. Retrying with UTIF decoder.", e);
				Utils._loadImageUTIF(url, callback);
			} else {
				console.error("ERROR: could not load the given image.", e);
			}
		};
		
		imageObj.src = url;
	},

	/**
	 * Used internally by @see {@link Utils.loadImage} to retry loading TIFFs with the
	 * UTIF.js decoder that otherwise failed with the built-in decoder.
	 * @param {*} url The image base64 URL/URI.
	 * @param {*} callback a function to call when image.onload happens.
	 */
	_loadImageUTIF: async function(url, callback) {
		// useful links
		// https://github.com/photopea/UTIF.js/
		// https://observablehq.com/@ehouais/decoding-tiff-image-data
		// https://stackoverflow.com/a/52410044/883015

		// 
		// let blob = await fetch(url).then(r => r.blob());
		await fetch(url).then(response => response.blob()) // get the url as a blob
			.then(blob => blob.arrayBuffer()) // get the data as a array/buffer
			.then(UTIF.bufferToURI) // decode the data as an RGBA8 image data URI
			.then(function(decoded_as_rgba8_url){
				// load the image once again as usual...
				Utils.loadImage(decoded_as_rgba8_url, callback, false);
			}); 
	},

	/**
	 * Attempts to get the value or text within a given element/control.
	 * @param {object|jQuery} $e the jquery wrapped DOM element.
	 * @returns the value contained or represented in the given control/element.
	 */
	getInputValueInt: function($e){
		var rawValue = parseInt($e.val());
		if (isNaN(rawValue))
			return parseInt($e.attr('placeholder'));
		return rawValue;
	},

	getRowsInput: function(){ return G_GUI_Controller.pixelCountY; },
	getColsInput: function(){ return G_GUI_Controller.pixelCountX; },
	getBrightnessInput: function(){ return G_GUI_Controller.brightness; },
	getContrastInput: function(){ return G_GUI_Controller.contrast; },
	getGlobalBCInput: function(){ return G_GUI_Controller.globalBC; },
	getCellWInput: function(){ return this.getInputValueInt($('#iCellW')); },
	getCellHInput: function(){ return this.getInputValueInt($('#iCellH')); },
	getSpotXInput: function(){ return this.getInputValueInt($('#iSpotX')); },
	getSpotYInput: function(){ return this.getInputValueInt($('#iSpotY')); },
	getSpotAngleInput: function(){ return this.getInputValueInt($('#iSpotAngle')); },
	getGroundtruthImage: function(){ return G_GUI_Controller.groundTruthImg; },
	getPixelSizeNmInput: function(){ return G_GUI_Controller.pixelSize_nm; },
	setPixelSizeNmInput: function(val){ G_GUI_Controller.controls.pixelSize_nm.setValue(val); },
	getShowRulerInput: function(){ return G_GUI_Controller.showRuler; },
	getSpotLayoutOpacityInput: function(){ return G_GUI_Controller.previewOpacity; },
	getImageMetricAlgorithm: function(){ return G_GUI_Controller.imageMetricAlgo; },
	getImageSmoothing: function(){ return G_GUI_Controller.imageSmoothing; },
	getImageFillMode: function(){
		// TODO: maybe add a GUI option to toggle between fit, fill, stretch modes...
		// just a default for now, until support for this is implemented
		// https://github.com/joedf/ImgBeamer/issues/7

		// TODO: likely have a global 'enum' of all the fill modes?
		
		// return "fit";
		return "squish";
	},

		/**
	 * Creates a Zoom event handler to be used on a stage.
	 * Holding the shift key scales at half the rate.
	 * @param {object} stage the drawing stage
	 * @param {object} konvaObj the figure or object on the stage to change.
	 * @param {function} callback a callback for when the zoom event handler is called.
	 * @param {number} scaleFactor the scale factor per "tick"
	 * @param {number|function} scaleMin the scale minimum allowed defined as a number or function.
	 * @param {number|function} scaleMax the scale maximum allowed defined as a number or function.
	 * @returns the created event handler
	 */
	// eslint-disable-next-line no-magic-numbers
	MakeZoomHandler: function(stage, konvaObj, callback=null, scaleFactor=1.2, scaleMin=0, scaleMax=Infinity){
		var _self = this;
		var handler = function(e){
			// modified from https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html 
			e.evt.preventDefault(); // stop default scrolling
			
			var scaleBy = scaleFactor;
			
			// Do half rate scaling, if shift is pressed
			if (e.evt.shiftKey) {
				scaleBy = 1 +((scaleBy-1) / 2);
			}

			// how to scale? Zoom in? Or zoom out?
			let direction = e.evt.deltaY > 0 ? -1 : 1;
			var oldScale = konvaObj.scaleX();
			var pointer = stage.getPointerPosition();
			var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

			// Allow scale[Min/Max] to be functions or numbers...
			var _scaleMin = (typeof scaleMin == 'function') ? scaleMin(oldScale, newScale) : scaleMin;
			var _scaleMax = (typeof scaleMax == 'function') ? scaleMax(oldScale, newScale) : scaleMax;

			// Limit scale based on given bounds
			var finalScale = Math.min(_scaleMax, Math.max(_scaleMin, newScale));
			
			if (pointer != null)
				_self.scaleCenteredOnPoint(pointer, konvaObj, oldScale, finalScale);
			else {
				if (G_DEBUG) {
					console.warn("MakeZoomHandler got a null pointer...");
				}
			}

			stage.draw();

			if (typeof callback == 'function')
				callback(e);
		};

		return handler;
	},

	/**
	 * Creates a ruler control / drawable on the given layer of a konva stage.
	 * Scaling is calculated using the stage size, the input image size,
	 * and the (globally set) image pixel size in "real" / physical units.
	 * @param {*} layer The layer of the stage to draw on.
	 * @param {*} oImg The input image.
	 * @param {*} x1 the starting x coordinate of the ruler line.
	 * @param {*} y1 the starting y coordinate of the ruler line.
	 * @param {*} x2 the ending x coordinate of the ruler line.
	 * @param {*} y2 the ending y coordinate of the ruler line.
	 * @returns an object with the property "element" for the drawable control,
	 * a getLengthNm() method to get the current length of the ruler in physical units,
	 * a getPixelSize(lengthNm) method to calculate the pixel size in physical (nm) units
	 * based on the new specified length of the ruler in physical (nm) units,
	 * and a doUpdate() method to update the ruler to represent the its latest state.
	 */
	CreateRuler: function(layer, oImg, x1 = 0, y1 = 100, x2 = 100, y2 = 100) {
		var stage = layer.getStage();

		var lengthNm = 0;

		var updateCalc = function(){
			//TODO: maybe have scaling function for this...?
			var linePts = line.points();
			var pxSizeNmX = Utils.getPixelSizeNmInput();
			
			// we need to scale by stage size as well and image size...
			var pt1 = Utils.stageToImagePixelCoordinates(linePts[0], linePts[1], stage, oImg);
			var pt2 = Utils.stageToImagePixelCoordinates(linePts[2], linePts[3], stage, oImg);

			// and convert to "real" units
			// currently we only have pixel size in X direction
			var nm1 = Utils.imagePixelToRealCoordinates(pt1.x, pt1.y, pxSizeNmX);
			var nm2 = Utils.imagePixelToRealCoordinates(pt2.x, pt2.y, pxSizeNmX);

			// before we make the distance calculation
			// this is done to support non-square pixels
			var distNm = Utils.distance(nm1.x, nm1.y, nm2.x, nm2.y);
			var fmt = Utils.formatUnitNm(distNm);
			text.text(fmt.value.toFixed(G_MATH_TOFIXED.SHORT) + " " + fmt.unit);

			lengthNm = distNm;
		};

		var calculateNewPixelSize = function(lengthNm){
			// does the "reverse" calculation for the pixel size
			
			// get points in image pixel coordinates
			var linePts = line.points();
			var pt1 = Utils.stageToImagePixelCoordinates(linePts[0], linePts[1], stage, oImg);
			var pt2 = Utils.stageToImagePixelCoordinates(linePts[2], linePts[3], stage, oImg);

			// compute x/y components and scale it accordingly
			var dx = Math.abs(pt1.x - pt2.x);
			var dy = Math.abs(pt1.y - pt2.y);

			// compute angle
			// https://stackoverflow.com/a/9614122/883015
			var radAngle = Math.atan2(dy, dx);

			// decompose the given length in to x/y components
			// this is done to support non-square pixels
			var length = {
				x: lengthNm * Math.cos(radAngle),
				y: lengthNm * Math.sin(radAngle),
			};

			// calculate pixel size
			var pxSizeNm = {
				x: length.x / dx,
				y: length.y / dy,
			};

			return pxSizeNm;
		};

		var anchorMove = function(e, anchor){
			// shift-key makes straight horizontal line
			if (e.evt.shiftKey) {
				if (anchor == anchors.start) {
					anchors.start.y(anchors.end.y());
				} else {
					anchors.end.y(anchors.start.y());
				}
			}

			// ctrl-key makes straight vertical line
			else if (e.evt.ctrlKey) {
				if (anchor == anchors.start) {
					anchors.start.x(anchors.end.x());
				} else {
					anchors.end.x(anchors.start.x());
				}
			}

			line.points([
				anchors.start.x() - line.x(),
				anchors.start.y() - line.y(),
				anchors.end.x() - line.x(),
				anchors.end.y() - line.y()
			]);
		};

		var anchors = {
			start: this._CreateAnchor(x1, y1, anchorMove),
			end: this._CreateAnchor(x2, y2, anchorMove),
		};

		var group = new Konva.Group({
			draggable: true,
		});
		var line = new Konva.Arrow({
			pointerAtBeginning: true,
			points: [x1, y1, x2, y2],
			strokeWidth: 2,
			fill: "lime",
			stroke: 'lime',
		});
		line.on("mouseover", function(){ this.strokeWidth(4); });
		line.on("mouseout", function(){ this.strokeWidth(2); });
		group.on('mouseover', function(){ document.body.style.cursor = "pointer"; });
		group.on('mouseout', function(){
			document.body.style.cursor = "default";
			tooltip.hide();
		});
		group.on('mousemove', function(){
			var mousePos = stage.getPointerPosition();
			tooltip.position(mousePos);
			var offset = 5;
			tooltip.offsetX(-offset);
			tooltip.offsetY(-offset);
			tooltip.show();
		});

		var updateLabel = function(){
			updateCalc();
			var linePts = line.points();
			label.position({
				x: (linePts[0] + linePts[2]) / 2,
				y: (linePts[1] + linePts[3]) / 2,
			});
			label.offsetX(label.width() / 2);
			label.offsetY(label.height() / 2);
		};
		group.on('dragmove', updateLabel);

		var label = new Konva.Label();
		var text = new Konva.Text({
			text: '0.00 nm',
			fontFamily: 'monospace',
			fontSize: 12,
			// fontStyle: 'bold',
			padding: 5,
			fill: 'lime',
			fillAfterStrokeEnabled: true,
			stroke: 'black',
			listening: false,
		});
		label.add(text);

		var tooltip = new Konva.Text({
			text: 'Double-click to set the pixel size / scaling.',
			fontSize: 12,
			width: 150,
			padding: 8,
			fill: 'white',
			fillAfterStrokeEnabled: true,
			stroke: 'black',
			visible: false,
			listening: false,
		});

		group.add(line, anchors.start, anchors.end, label);
		layer.add(group, tooltip);

		updateLabel();

		// return {"group": group, "archors": anchors, "line": line};
		return {
			element: group,
			getLengthNm: function(){ return lengthNm; },
			getPixelSize: function(lengthNm){
				return calculateNewPixelSize(lengthNm);
			},
			doUpdate: function(){ updateLabel(); },
		};
	},

	_CreateAnchor: function(x, y, onMove, strokeWidth = 2) {
		// modified from:
		// https://konvajs.org/docs/sandbox/Modify_Curves_with_Anchor_Points.html
		var anchor = new Konva.Circle({
			x: x,
			y: y,
			radius: 5,
			stroke: "#666",
			fill: "#ddd",
			strokeWidth: strokeWidth,
			draggable: true,
			opacity: 0.4,
		});

		// add hover styling
		anchor.on("mouseover", function () {
			document.body.style.cursor = "pointer";
			this.strokeWidth(strokeWidth + 2);
		});
		anchor.on("mouseout", function () {
			document.body.style.cursor = "default";
			this.strokeWidth(strokeWidth);
		});
		anchor.on("dragmove", function (e) {
			if (typeof onMove == 'function')
				onMove(e, this);
		});

		return anchor;
	},

	/**
	 * Creates a random integer between 0 and the given maximum.
	 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
	 * @param {number} max the largest value possible.
	 * @returns a random number.
	 */
	getRandomInt: function(max) {
		return Math.floor(Math.random() * max);
	},

	/**
	 * Initiates a download of the given resource, like programmatically clicking on a download link.
	 * function from:
	 * https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html
	 * https://stackoverflow.com/a/15832662/512042
	 * @param {string} uri a url pointing to the resource to download.
	 * @param {*} name the filename to use for the downloaded file.
	 */
	downloadURI: function(uri, name) {
		var link = document.createElement('a');
		link.download = name;
		link.href = uri;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		// delete link;
	},

	/**
	 * Updates the displayed statistics or parameters on the Spot profile.
	 * @param {*} stage the drawing stage for the spot profile and where to display the values.
	 * @param {*} beam the beam used for the spot layout and sampling of the image (after scaling).
	 * @param {*} cellSize the size of a cell in the raster grid of the resulting image.
	 * @param {*} userImage the scaled image by the user (in spot content) used to size the beam.
	 */
	updateDisplayBeamParams: function(stage, beam, cellSize, userImage, onDblClick) {
		// calculate and display the values
		const infoclass = "parameterDisplay";
		var element = this.ensureInfoBox(stage, infoclass, onDblClick);
		if (element) {
			var beamSizeA = beam.radiusX() * beam.scaleX(),
			beamSizeB = beam.radiusY() * beam.scaleY();
		
			// swap them so that is beamSizeA the larger one, for convention
			if (beamSizeA < beamSizeB) { [beamSizeA, beamSizeB] = [beamSizeB, beamSizeA]; }
			// https://www.cuemath.com/geometry/eccentricity-of-ellipse/
			var eccentricity = Math.sqrt(1 - (Math.pow(beamSizeB,2) / Math.pow(beamSizeA,2)));

			var spotSizeX = NaN, spotSizeY = NaN;
			if (typeof userImage != 'undefined'){
				var bw = (beam.width()*beam.scaleX()) / userImage.scaleX();
				var bh = (beam.height()*beam.scaleY()) / userImage.scaleY();

				spotSizeX = (bw / cellSize.w)*100;
				spotSizeY = (bh / cellSize.h)*100;
			}

			// display it
			element.innerHTML = 'Eccentricity: '+eccentricity.toFixed(G_MATH_TOFIXED.SHORT) +'<br>'
			+ 'Rotation: '+beam.rotation().toFixed(G_MATH_TOFIXED.MIN)+"°" +'<br>'
			+ 'Width: '+spotSizeX.toFixed(G_MATH_TOFIXED.MIN)+'%' +'<br>'
			+ 'Height: '+spotSizeY.toFixed(G_MATH_TOFIXED.MIN)+'%';

			// tooltip
			element.title = 'Double-click to change the spot width.';
		}
	},

	/**
	 * Calculates cell size based on given object (eg. rect, stage, or image), rows and cols
	 * @param {*} rect a Konva object that has a width and height, usually a rect, image, or stage.
	 * @param {number} rows (optional) the number of rows to split the area into.
	 * If not is provided, attempts to get it from gui/input.
	 * @param {number} cols (optional) the number of columns to split the area into.
	 * If not is provided, attempts to get it from gui/input.
	 * @returns the size (w,h) of a cell in the raster grid.
	 */
	computeCellSize: function(rect, rows = -1, cols = -1){
		if (rows <= 0) { rows = this.getRowsInput(); }
		if (cols <= 0) { cols = this.getColsInput(); }

		var cellSize = {
			w: rect.width() / cols,
			h: rect.height() / rows,
		};
		return cellSize;
	},

	/**
	 * Calculates the magnification based on the given rectangles' width and scaleX
	 * @param {*} rectBase The original object
	 * @param {*} rectScaled The scaled object
	 * @returns The magnification (ratio)
	 */
	computeMagLevel: function(rectBase, rectScaled) {
		var rW = (rectScaled.width() * rectScaled.scaleX()) / (rectBase.width() * rectBase.scaleX());
		return rW;
	},

	/**
	 * Displays and updates the magnification.
	 * @param {*} destStage The stage to display the info on.
	 * @param {*} scaledRect The shape to calculate the magnification from compared to its stage.
	 */
	updateMagInfo: function(destStage, scaledRect) {
		// add/update the mag disp. text
		const infoclass = "magDisplay";
		var element = this.ensureInfoBox(destStage, infoclass);
		if (element) {
			var magLevel = this.computeMagLevel(scaledRect.getStage(), scaledRect);
			var fmtMag = magLevel.toFixed(G_MATH_TOFIXED.SHORT) + 'X';

			// display it
			element.innerHTML = fmtMag;
			G_GUI_Controller.digitalMag = fmtMag;
		}
	},

	/**
	 * Displays and updates the Image metrics, if {@link G_IMG_METRIC_ENABLED} is true.
	 * @param {*} sourceStage The stage for the ground truth / reference image
	 * @param {*} destStage The stage for the image to compare
	 */
	updateImageMetricsInfo: function(sourceStage, destStage) {
		// create info dialog as needed
		const dialogId = "dialog-imgMetric";
		const eTitle = "Double-click for more information.";
		var onDblClick = function(){
			let dialog = $('#'+dialogId);
			if (dialog.length) {
				dialog.dialog('open');
			} else {
				var elem = $("<div/>")
				.attr({
					'id': dialogId,
					'title': G_APP_NAME + " - Image Quality Metric"
				})
				.css({'display':'none'})
				.addClass('jui')
				.html(`
				<div>
				<input type="hidden" autofocus="autofocus" />

				<p><b>Image Quality</b></p>

				<p>
				The intended use of an image metric in this application is more of a qualitative
				nature, rather than quantitative. The user should be able to grasp any trends in the
				change of the image quality metric when the imaging parameters are changed.
				</p>

				<p>
				That said, it is the trends or change in the image quality metric values that
				are important, more so than the values themselves.
				Other than the MSE and PSNR algorithms, a value of 0.0 indicates the lowest
				score or match when compared to the original (ground truth) image. Whereas
				a maximum score of 1.0 indicates a perfect match. Naturally, the ground truth image
				is assumed to be of optimum quality for this comparison.
				<p>

				<details>
				<summary><b>Additional Information</b></p></summary>
				<p>For performance reasons, the metric is only updated at every quarter of the image
				drawn, or if the draw-rate is fast, <i>i.e.</i>, less than 50 ms/row
				(for non SSIM-based algorithms).
				</p>

				<p>Unfortunately, there is no flawless or foolproof image quality metric.
				Over 20 different image metrics have been reviewed and compared by
				<a href="https://www.sciencedirect.com/science/article/pii/S2214241X15000206">
				Jagalingam and Hegde in a 2015 paper</a>, each with
				their different strengths and weaknesses.
				</p>
				<ul>
				<li>More information on the purpose and intended use can be found
				<a href="https://github.com/joedf/CAS741_w23/blob/main/docs/SRS/SRS.pdf">here</a>.</li>
				<li>A comparison of various image quality metrics used in this application is available
				<a href="https://github.com/joedf/CAS741_w23/blob/main/docs/VnVReport/VnVReport.pdf">here</a>.</li>
				</ul>
				</details>

				</div>
				`);

				elem.dialog({
					modal: true,
					width: 540,
					buttons: {
						Ok: function() {
							$( this ).dialog( "close" );
						}
					}
				});
			}
		};

		// calculate and display
		const infoclass = "metricsDisplay";
		var element = this.ensureInfoBox(destStage, infoclass, onDblClick, eTitle);
		if (element) {

			// Show/hide the img-metric based on the global boolean
			$(element).toggle(G_IMG_METRIC_ENABLED);
			
			// only do the calc, if enabled
			if (G_IMG_METRIC_ENABLED) {
				// compare without Image Smoothing
				const imageSmoothing = false;

				// get ground truth image
				var refImage = this.getFirstImageFromStage(sourceStage);
				var refData = this.getKonvaImageData(refImage, imageSmoothing);

				// get the image without the row/draw indicator
				var finalImage = this.getVirtualSEM_KonvaImage(destStage);
				var finalData = this.getKonvaImageData(finalImage, imageSmoothing);

				// Do the metric calculation here
				// based on the algorithm/metric chosen...
				var metricValue = 0;
				var algo = Utils.getImageMetricAlgorithm();
				if (algo.indexOf('SSIM') >= 0) {
					// needed for the SSIM / MS-SSIM library
					const img_channel_count = 4;
					refData.channels = img_channel_count;
					finalData.channels = img_channel_count;

					let metrics = ImageMSSSIM.compare(refData, finalData);
					if (algo == "MS-SSIM") {
						metricValue = metrics.msssim;
					} else {
						metricValue = metrics.ssim;
					}
				} else { // 'MSE', 'PSNR', 'iNRMSE', 'iNMSE'
					let metrics = NRMSE.compare(refData, finalData);
					switch(algo) {
						case 'MSE': metricValue = metrics.mse; break;
						case 'PSNR': metricValue = metrics.psnr; break;
						case 'iNMSE': metricValue = metrics.inmse; break;
						default: metricValue = metrics.inrmse;
					}
				}

				// display it
				element.innerHTML = algo + " = " + metricValue.toFixed(G_MATH_TOFIXED.LONG);
			}
		}
	},

	updateSubregionPixelSize: function(destStage, subregionImage, imageObj){
		var rows = Utils.getRowsInput(), cols = Utils.getColsInput();

		var rect = {
			w: subregionImage.width() * subregionImage.scaleX(),
			h: subregionImage.height() * subregionImage.scaleY(),
		};

		// TODO: maybe get the ground truth image stage for the size info instead,
		// we are likely "cheating" here because all stages share the same size
		// in the current design...
		var gt_stage_size = destStage.size();

		var pxSizeNm = Utils.getPixelSizeNmInput();
		var fullImgSize = {
			w: imageObj.naturalWidth * pxSizeNm,
			h: imageObj.naturalHeight * pxSizeNm,
		};
		// similar formula to the used for the subregion rect in the groundtruth view
		var subregionSizeNm = {
			w: (gt_stage_size.width / rect.w) * fullImgSize.w,
			h: (gt_stage_size.height / rect.h) * fullImgSize.h,
		};

		// get optimal / formated unit
		// TODO: maybe use "this." instead of "Utils."
		// do it for all functions too?
		var fmtPxSize = Utils.formatUnitNm(
			subregionSizeNm.w / cols,
			subregionSizeNm.h / rows
		);

		// display coords & FOV size
		Utils.updateExtraInfo(destStage,
			fmtPxSize.value.toFixed(G_MATH_TOFIXED.SHORT) + ' x '
			+ fmtPxSize.value2.toFixed(G_MATH_TOFIXED.SHORT)
			+ ' ' + fmtPxSize.unit + '/px'
		);
	},

	/**
	 * Displays and updates additional info on the given stage
	 * @param {*} destStage The stage to display info on.
	 * @param {string} infoText Text to display.
	 */
	updateExtraInfo: function(destStage, infoText) {
		const infoclass = "extraInfoDisplay";
		var element = this.ensureInfoBox(destStage, infoclass);
		if (element) {
			// display it
			element.innerHTML = infoText;
		}	
	},

	/**
	 * Conditionally displays a small warning icon if it meets the G_AUTO_PREVIEW_LIMIT.
	 * This icon can be hovered or double-clicked to obtain
	 * a message explaining the drawing is done row-by-row instead of frame-by-frame
	 * for performance / responsiveness.
	 * @param {*} stage The stage to display it on.
	 * @todo Currently, only used for the Subregion resampled stage, could be used elsewhere?
	 */
	updateVSEM_ModeWarning: function(stage) {
		// add Row-by-row / vSEM mode warning
		var vSEM_note = $(stage.getContainer()).find('.vsem_mode').first();
		var alreadyAdded = vSEM_note.length > 0;

		// check if we should create it and add the UI element
		if (!alreadyAdded) {
			vSEM_note = Utils.ensureInfoBox(stage, 'vsem_mode',
				function(){
					alert($(this).attr('title'));
				}
			);
			if (vSEM_note) {
				// warn icon from GitHub's octicons (https://github.com/primer/octicons)
				// eslint-disable-next-line max-len
				const warnIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="#FFFF00" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>';
				vSEM_note.innerHTML = warnIcon;
				vSEM_note.title = "For higher pixel counts, the drawing is done "
					+ "row-by-row instead of frame-by-frame "
					+ "for improved performance / responsiveness.";
				$(vSEM_note).hide();
			}
		}

		// check if we should show/hide it
		var rows = Utils.getRowsInput(), cols = Utils.getColsInput();
		var showWarnVSEM = (rows*cols > G_AUTO_PREVIEW_LIMIT);
		$(vSEM_note).toggle(showWarnVSEM);
	},

	/** 
	 * Updates the displayed element to be shown/hidden according
	 * to the advanced mode setting. Affects all HTML elements with
	 * the class "advancedMode".
	 */
	updateAdvancedMode: function(){
		var isAdvModeON = false;
		if (typeof G_GUI_Controller !== 'undefined' || G_GUI_Controller !== null){
			isAdvModeON = G_GUI_Controller.advancedMode;
		}
		
		$('.advancedMode').toggle(isAdvModeON);
	},

	/**
	 * Gets or creates an info-box element on the given stage.
	 * @param {*} stage The stage on which display/have the info-box.
	 * @param {string} className The class name of the info-box DOM element.
	 * @param {function} [onDblClick] bound on creation, the event handler / callback for on-doubleclick event
	 * @param {string} [title] Optional title / tooltip text.
	 * @returns the info-box DOM element.
	 */
	ensureInfoBox: function(stage, className, onDblClick, title) {
		// get stage container
		var eStage = $(stage.getContainer());
		
		// check if we create the element already
		var e = eStage.children('.'+className+':first');
		if (e.length <= 0) {
			// not found, so create it
			eStage.prepend('<span class="infoBox '+className+'"></span>');
			e = eStage.children('.'+className+':first');
			
			if (typeof title == 'string') {
				e.attr('title', title);
			}
		}

		// return the non-jquery-wrapped DOM element
		var element = e.get(0);

		// but return false if not found or unsuccessful
		if (typeof element == 'undefined')
			return false;

		// attach the dbclick event handler if one was given
		// we bind everytime instead of only on-creation to prevent
		// any issues with stale references in the given handler function.
		if (typeof onDblClick == 'function') {
			// ensure we remove all previous dblclick handlers so dont end up
			// with multiple instances of the handler being triggered...
			e.unbind('dblclick').on('dblclick', onDblClick);
		}

		return element;
	},

	/**
	 * Calculates a new size (width and height) for the given object to fit in a stage's view bounds.
	 * @param {number} w the original width
	 * @param {number} h the original height
	 * @param {number} maxDimension The largest dimension (whether width or height) to fit in.
	 * @param {boolean} fillMode Whether to do a "fill", "fit" / "letterbox", "crop", or "squish" fit.
	 * @returns the new calculated size
	 * @todo fillMode is not yet fully supported, see https://github.com/joedf/ImgBeamer/issues/7
	 */
	fitImageProportions: function(w, h, maxDimension, fillMode="squish"){
		var mode = fillMode.toLowerCase().trim();

		// image ratio to "fit" in canvas
		var ratio = (w > h ? (w / maxDimension) : (h / maxDimension)); // fit
		if (mode == "fill"){
			ratio = (w > h ? (h / maxDimension) : (w / maxDimension)); // fill
		}
		if (mode == "squish") {
			return {w: maxDimension, h: maxDimension};
		}

		var iw = w/ratio; //, ih = h/ratio;
		return {w: iw, h: iw};
	},

	/**
	 * Scales the given shape, and moves it to preserve original center
	 * @todo maybe, no need to have oldScale specified, can be obtained from shape.scale() ...
	 * @todo possibly simplify this like {@link Utils.centeredScale} and remove the other?
	 * @param {*} stage The stage of the shape object
	 * @param {*} shape the shape object itself
	 * @param {*} oldScale the shapes old scale
	 * @param {*} newScale the new scale
	 */
	scaleOnCenter: function(stage, shape, oldScale, newScale){
		var stageCenter = {
			x: stage.width()/2 - stage.x(),
			y: stage.height()/2 - stage.y()
		};
		this.scaleCenteredOnPoint(stageCenter, shape, oldScale, newScale);
	},

	/**
	 * shorthand for @see {@link Utils.scaleOnCenter}.
	 * Gets the stage and original scale from the shape directly.
	 * @param {*} shape the shape to scale
	 * @param {*} newScale the new scale.
	 */
	centeredScale: function(shape, newScale){
		this.scaleOnCenter(shape.getStage(), shape, shape.scaleX(), newScale);
	},

	/**
	 * Scales the given shaped while keeping it centered on the given point.
	 * @param {*} point the centering point.
	 * @param {*} shape the shape to scale and position.
	 * @param {*} oldScale the shape's original scale
	 * @param {*} newScale the shape's new scale
	 */
	scaleCenteredOnPoint: function(point, shape, oldScale, newScale){
		// could be expanded to do both x and y scaling
		shape.scale({x: newScale, y: newScale});
		var oldPos = {
			x: (point.x - shape.x()) / oldScale,
			y: (point.y - shape.y()) / oldScale,
		};
		shape.position({
			x: point.x - oldPos.x * newScale,
			y: point.y - oldPos.y * newScale,
		});
	},

	/**
	 * Computes the average pixel value assuming an RGBA format, with a max of 255 for each component.
	 * @param {ImageData} raw The image data (access to pixel data).
	 * @returns an array of the average pixel value [R,G,B,A].
	 */
	get_avg_pixel_rgba: function(raw) {
		var blanks = 0;
		var d = raw.data;

		var sum = [0, 0, 0, 0];

		for (var i = 0; i < d.length; i += 4) {
			// Optimization note, with greyscale we only need to process one component...
			const px = [d[i], d[i+1], d[i+2], d[1+3]];
			// var r = px[0], g = px[1], b = px[2], a = px[3];

			if (px.every(c => c === 0)) {
				blanks += 1;
			} else {
				sum[0] += px[0];
				sum[1] += px[1];
				sum[2] += px[2];
				sum[3] += px[3];
			}
		}

		var total = raw.width * raw.height;
		// or eq... var total = d.length / 4;
		var fills = Math.max(1, total - blanks);

		var avg = [
			Math.round(sum[0] / fills),
			Math.round(sum[1] / fills),
			Math.round(sum[2] / fills),
			(255 - Math.round(sum[3] / fills)) / 255 // rgba - alpha is 0.0 to 1.0
		];

		var percent = (blanks / total) * 100;

		if (G_DEBUG) {
			console.log(blanks, total, percent);
			console.log("avg px=", avg.toString());
		}

		return avg;
	},

	/**
	 * Computes the average grayscale pixel value assuming an RGBA format, with a max of 255 for each component.
	 * However, only the R (red) component is considered.
	 * @param {ImageData} raw The image data (access to pixel data).
	 * @returns a number representing the average pixel value intensity (0 to 255).
	 */
	get_avg_pixel_gs: function(raw) {
		var blanks = 0;
		var d = raw.data;

		var sum = 0;

		// Optimization note, with greyscale we only need to process one component...
		for (var i = 0; i < d.length; i += 4) {
			const px = d[i];
			const alpha = d[i+3];

			if (px === 0 && alpha === 0) {
				blanks += 1;
			} else {
				sum += px;
			}
		}

		var total = raw.width * raw.height;
		var fills = Math.max(1, total - blanks);

		var avg = Math.round(sum / fills);
		
		return avg;
	},

	/**
	 * Draws a grid on a given drawing stage.
	 * Based on solution-1 from: https://longviewcoder.com/2021/12/08/konva-a-better-grid
	 * @param {*} gridLayer a layer on the stage to use for drawing the grid on.
	 * @param {*} rect a rectangle represing the size and position of the grid to draw.
	 * @param {number} rows the number of rows in the grid.
	 * @param {number} cols the number of columns in the grid.
	 * @param {*} lineColor the line color of the grid.
	 * @returns the cell size (width, height)
	 */
	drawGrid: function(gridLayer, rect, rows, cols, lineColor) {

		if (typeof lineColor == 'undefined' || lineColor == null || lineColor.length < 1)
			lineColor = 'rgba(255, 255, 255, 0.8)';

		var startX = rect.x();
		var startY = rect.y();

		var stepSizeX = rect.width() / cols;
		var stepSizeY = rect.height() / rows;
	
		const xSize = gridLayer.width(), // stage.width(), 
			ySize = gridLayer.height(), // stage.height(),
			xSteps = cols, //Math.round(xSize/ stepSizeX), 
			ySteps = rows; //Math.round(ySize / stepSizeY);

		// draw vertical lines
		for (let i = 0; i <= xSteps; i++) {
			gridLayer.add(
				new Konva.Line({
					x: startX + (i * stepSizeX),
					points: [0, 0, 0, ySize],
					stroke: lineColor,
					strokeWidth: 1,
				})
			);
		}
		//draw Horizontal lines
		for (let i = 0; i <= ySteps; i++) {
			gridLayer.add(
				new Konva.Line({
					y: startY + (i * stepSizeY),
					points: [0, 0, xSize, 0],
					stroke: lineColor,
					strokeWidth: 1,
				})
			);
		}

		gridLayer.batchDraw();

		var cellInfo = {
			width: stepSizeX,
			height: stepSizeY,
		};

		return cellInfo;
	},

	/**
	 * Draws a given shape repeatedly (clones) in a grid pattern.
	 * The shape will be drawn {@link rows} by {@link cols} times.
	 * Originally based from drawGrid() ...
	 * @param {*} layer The layer to draw on
	 * @param {*} rect The bounds of the grid pattern
	 * @param {*} shape The shape to draw
	 * @param {number} rows the number of rows for the grid
	 * @param {number} cols the number of columns for the grid
	 */
	repeatDrawOnGrid: function(layer, rect, shape, rows, cols) {
		var startX = rect.x();
		var startY = rect.y();

		var stepSizeX = rect.width() / cols;
		var stepSizeY = rect.height() / rows;

		var cellCenterX = stepSizeX / 2;
		var cellCenterY = stepSizeY / 2;

		// interate over X
		for (let i = 0; i < cols; i++) {
			// interate over Y
			for (let j = 0; j < rows; j++) {
				var shapeCopy = shape.clone();

				shapeCopy.x(startX + (i * stepSizeX) + cellCenterX);
				shapeCopy.y(startY + (j * stepSizeY) + cellCenterY);

				layer.add( shapeCopy );
			}
		}

		layer.batchDraw();
	},

	/**
	 * Draws a "stenciled" version of the given image and probe/shape based the grid parameters.
	 * "Stenciles" on a grid with an array of "cloned" spots.
	 * @param {*} previewStage The stage to draw on.
	 * @param {*} image The image to draw and "stencil".
	 * @param {*} probe The shape to stencil image with repeatedly in a grid pattern
	 * @param {number} rows The number of rows for the grid
	 * @param {number} cols The number of columns for the grid
	 * @param {*} rect The bounds for the grid
	 * @todo Likely remove it, deprecated and no longer used by anything...
	 */
	computeResampledPreview: function(previewStage, image, probe, rows, cols, rect){
		var previewLayer = previewStage.getLayers()[0];
		previewLayer.destroyChildren();

		var gr = image.clone();
		gr.globalCompositeOperation('source-in');

		this.repeatDrawOnGrid(previewLayer, rect, probe, rows, cols);
		previewLayer.add(gr);
	},

	/**
	 * Draws a resampled image with the given spot/probe.
	 * Samples on a grid with an array of "cloned" spots.
	 * The sampling grid fits the full size of the destination stage.
	 * @deprecated This has been replaced by {@link Utils.computeResampledSlow} due to accuracy concerns.
	 * @todo review this function, maybe remove or improve.
	 * @param {*} sourceStage The stage for the original image to pixel data from.
	 * @param {*} destStage The destination stage to draw on.
	 * @param {*} image The image size and position.
	 * @param {*} probe The sampling shape or probe
	 * @param {number} rows The number of rows for the sampling grid
	 * @param {number} cols The number of columns for the sampling grid
	 */
	computeResampledFast: function(sourceStage, destStage, image, probe, rows, cols){
		var destLayer = destStage.getLayers()[0];
		destLayer.destroyChildren(); 

		var layer = sourceStage.getLayers()[0];
		// layer.cache();
		var ctx = layer.getContext();


		var lRatio = ctx.getCanvas().pixelRatio;

		
		// process each grid cell
		var startX = image.x(), startY = image.y();
		var stepSizeX = image.width() / cols, stepSizeY = image.height() / rows;

		// interate over X
		for (let i = 0; i < cols; i++) {
			// interate over Y
			for (let j = 0; j < rows; j++) {
				var cellX = startX + (i * stepSizeX);
				var cellY = startY + (j * stepSizeY);
				var cellW = stepSizeX;
				var cellH = stepSizeY;

				var pxData = ctx.getImageData(
					cellX * lRatio,
					cellY * lRatio,
					cellW * lRatio,
					cellH * lRatio
				);

				if (!G_DEBUG) {
					// var avgPx = this.get_avg_pixel_rgba(pxData);
					// var avgColor = "rgba("+ avgPx.join(',') +")";
					var avg = Utils.get_avg_pixel_gs(pxData);
					var avgColor = "rgba("+[avg,avg,avg,1].join(',')+")";

					var cPixel = new Konva.Rect({
						listening: false,
						x: cellX,
						y: cellY,
						width: cellW,
						height: cellH,
						fill: avgColor,
					});

					destLayer.add(cPixel);

				} else {
					const canvas = document.createElement('canvas');
					canvas.width = cellW * lRatio;
					canvas.height = cellH * lRatio;
					canvas.getContext('2d').putImageData(pxData, 0, 0);
					const cPixel = new Konva.Image({
						image: canvas,
						listening: false,
						x: cellX,
						y: cellY,
						width: cellW,
						height: cellH,
					});

					destLayer.add(cPixel);
				}
			}
		}

		if (G_DEBUG) {
			this.drawGrid(destLayer, image, rows, cols);
		}
	},

	/**
	 * Essentially, this is {@link Utils.computeResampledFast}, but corrected for spot size larger than the cell size.
	 * Samples on a grid with an array of "cloned" spots.
	 * {@link Utils.computeResampledFast} limits the sampling to the cell size, and takes in smaller version of the
	 * image that is already drawn and "compositied" in a Konva Stage, instead of the original larger image...
	 * @param {*} sourceStage The stage to get the subregion area
	 * @param {*} destStage The stage to draw on
	 * @param {*} oImage The ground truth/source/original image to get data from.
	 * @param {*} probe The spot/probe to sample with
	 * @param {number} rows The number of rows for the sampling grid
	 * @param {number} cols The number of columns for the sampling grid
	 * @param {number} rect The bounds of the sampling grid
	 * @param {number} rowStart The row to start iterating over.
	 * @param {number} rowEnd The row at which to stop iterating over.
	 * @param {number} colStart The column to start iterating over.
	 * @param {number} colEnd The column at which to stop iterating over.
	 * @param {boolean} doClear Whether the layer should be cleared before drawing.
	 * @param {boolean} useLastLayer Whether to use the last (true) or first (false) layer to draw on.
	 */
	computeResampledSlow: function(sourceStage, destStage, oImage, probe, rows, cols, rect,
		rowStart = 0, rowEnd = -1, colStart = 0, colEnd = -1, doClear = true, useLastLayer = false){
		
		var layers = destStage.getLayers();
		var destLayer = layers[0];
		if (useLastLayer) { destLayer = layers[layers.length-1]; }
		if (doClear) { destLayer.destroyChildren(); }

		var pImage = oImage.image(),
		canvas = document.createElement('canvas'),
		// canvas = document.getElementById('testdemo'),
		ctx = canvas.getContext('2d');

		// get and transform cropped region based on user-sized konva-image for resampling
		var sx = (sourceStage.x() - oImage.x()) / oImage.scaleX();
		var sy = (sourceStage.y() - oImage.y()) / oImage.scaleY();
		var sw = sourceStage.width() / oImage.scaleX();
		var sh = sourceStage.height() / oImage.scaleY();

		canvas.width = destStage.width();
		canvas.height = destStage.height();
		

		var rw = (oImage.width() / pImage.naturalWidth);
		var rh = (oImage.height() / pImage.naturalHeight);

		ctx.drawImage(pImage,
			sx / rw, sy /rh, // crop x, y
			sw / rw, sh /rh, // crop width, height
			0, 0,
			destStage.width(),
			destStage.height()
			);

		var image = canvas; //oImage.image();

	/*
		var sx = (oImage.x() - sourceStage.x());// * oImage.scaleX();
		var sy = (oImage.y() - sourceStage.y());// * oImage.scaleY();
		var sw = sourceStage.width() * oImage.scaleX();
		var sh = sourceStage.height() * oImage.scaleY();
		destLayer.add(new Konva.Image({
			x: sx,
			y: sy,
			width: sw,
			height: sh,
			image: pImage,
		}));

		return;
		*/

		// process each grid cell
		var startX = 0, startY = 0;
		// var stepSizeX = image.naturalWidth / cols, stepSizeY = image.naturalHeight / rows;
		var stepSizeX = destStage.width() / cols, stepSizeY = destStage.height() / rows;

		var startX_stage = rect.x(), startY_stage = rect.y();
		var stepSizeX_stage = rect.width() / cols, stepSizeY_stage = rect.height() / rows;

		if (colEnd < 0) { colEnd = cols; }
		if (rowEnd < 0) { rowEnd = rows; }

		// interate over X
		for (let i = colStart; i < colEnd; i++) {
			// interate over Y
			for (let j = rowStart; j < rowEnd; j++) {
				var cellX = startX + (i * stepSizeX);
				var cellY = startY + (j * stepSizeY);
				var cellW = stepSizeX;
				var cellH = stepSizeY;

				probe.x(cellX + cellW/2);
				probe.y(cellY + cellH/2);

				var avg = this.ComputeProbeValue_gs(image, probe);
				var avgColor = "rgba("+[avg,avg,avg,1].join(',')+")";

				// Konva drawing
				var cellX_stage = startX_stage + (i * stepSizeX_stage);
				var cellY_stage = startY_stage + (j * stepSizeY_stage);
				var cellW_stage = stepSizeX_stage;
				var cellH_stage = stepSizeY_stage;

				var cPixel = new Konva.Rect({
					listening: false,
					x: cellX_stage,
					y: cellY_stage,
					width: cellW_stage,
					height: cellH_stage,
					fill: avgColor,
				});

				destLayer.add(cPixel);
			}
		}
	},

	/**
	 * Converts an angle in radians to degrees
	 * @param {number} angle the angle in radians.
	 * @returns the angle in degrees
	 */
	toDegrees: function(angle) { return angle * (180 / Math.PI); },

	/**
	 * Converts an angle in degrees to radians
	 * @param {number} angle the angle in degrees.
	 * @returns the angle in radians
	 */
	toRadians: function(angle) { return angle * (Math.PI / 180); },

	/**
	 * Calculates the euclidean distance.
	 * @param {*} x1 
	 * @param {*} y1 
	 * @param {*} x2 
	 * @param {*} y2 
	 * @returns the distance in the given coordinates' units.
	 */
	distance: function(x1, y1, x2, y2) {
		// https://stackoverflow.com/a/33743107/883015
		var dist = Math.hypot(x2-x1, y2-y1);
		return dist;
	},

	/**
	 * Gets the image scaling based on the Konva.Image size vs the image's true or 'natural' size.
	 * @param {*} konvaImage The konva image object
	 * @param {*} imageObj The actual image's HTML/DOM object
	 * @returns an object with the calculated values as properties 'x' and 'y'.
	 */
	imagePixelScaling: function(konvaImage, imageObj) {
		return {
			x: (konvaImage.width() / imageObj.naturalWidth),
			y: (konvaImage.height() / imageObj.naturalHeight),
		};
	},

	/**
	 * Convert stage to unit square coordinates
	 * @param {*} x 
	 * @param {*} y 
	 * @param {*} stage coordinates source stage
	 * @returns unit square coordinates
	 */
	stageToUnitCoordinates: function(x, y, stage){
		var centered = {
			x: x - (stage.width() / 2),
			y: y - (stage.height() / 2),
		};

		var unit = {
			x: centered.x / stage.width(),
			y: centered.y / stage.height(),
		};

		return unit;
	},

	/**
	 * Convert unit square to image pixel coordinates.
	 * @param {*} x 
	 * @param {*} y 
	 * @param {*} imageObj the original image object (with a width and height property)
	 * @returns image pixel coordinates
	 */
	unitToImagePixelCoordinates: function(x, y, imageObj) {
		return {
			x: x * imageObj.naturalWidth,
			y: y * imageObj.naturalHeight,
		};
	},

	/**
	 * Convert stage to Image pixel coordinates
	 * @param {*} x 
	 * @param {*} y 
	 * @param {*} stage coordinates source stage
	 * @param {*} imageObj the original image object (with a width and height property)
	 * @returns image pixel coordinates
	 */
	stageToImagePixelCoordinates: function(x, y, stage, imageObj) {
		var unit = this.stageToUnitCoordinates(x, y, stage);
		var ipixel = this.unitToImagePixelCoordinates(unit.x, unit.y, imageObj);
		return ipixel;
	},

	/**
	 * Convert image pixel to coordinates in "real" (or scaled) units
	 * @param {*} x 
	 * @param {*} y 
	 * @param {*} pxSizeX the width of a pixel in "real" units
	 * @param {*} pxSizeY the height of a pixel in "real" units
	 * @returns "real" coordinates
	 */
	imagePixelToRealCoordinates: function(x, y, pxSizeX, pxSizeY = null) {
		if (pxSizeY == null) { pxSizeY = pxSizeX; }
		return {
			x: x * pxSizeX,
			y: y * pxSizeY,
		};
	},
	
	/**
	 * Formats the values given to the appropriate display unit (nm or μm).
	 * @param {*} value_in_nm a value in nm.
	 * @param {*} value2_in_nm (optional) a value in nm.
	 * @returns an object containing the adjusted values and selected unit.
	 */
	formatUnitNm: function(value_in_nm, value2_in_nm = 0){
		/* eslint-disable no-magic-numbers */
		var out = {
			value: value_in_nm,
			value2: value2_in_nm,
			unit: "nm",
		};

		if (Math.abs(out.value) > 1000 || Math.abs(out.value2) > 1000) {
			out.value /= 1000;
			out.value2 /= 1000;
			out.unit = "μm";
		}
		/* eslint-enable no-magic-numbers */

		return out;
	},

	/**
	 * Generate a filename with a timestamp and the given prefix and counter.
	 * @param {string} prefix the filename prefix
	 * @param {number} counter a counter that has been incremented elsewhere
	 * @param {string} [fileExt="png"] the file extension
	 * @returns the filename.
	 */
	GetSuggestedFileName: function(prefix, counter, fileExt = "png"){
		const ISODateEnd = 10;
		var datestamp = new Date().toISOString().slice(0, ISODateEnd).replaceAll('-','.');
		var sCounter = String(counter).padStart(3,'0');
		var filename = prefix+"-"+datestamp+"-"+sCounter+"."+fileExt;
		return filename;
	},

	/** Used internally, for @see {@link Utils.ComputeProbeValue_gs} */
	_COMPUTE_GS_CANVAS: null,

	/**
	 * Gets the average pixel value (grayscale intensity) with the given image and one probe.
	 * @param {*} image the image to get pixel data from
	 * @param {*} probe the sampling shape/spot.
	 * @param {number} superScale factor to scale up ("blow-up") the image for the sampling.
	 * @returns the computed grayscale color
	 */
	ComputeProbeValue_gs: function(image, probe, superScale=1) {
		// var iw = image.naturalWidth, ih = image.naturalHeight;

		// get ellipse info
		var ellipseInfo = probe;
		if (typeof probe.getStage == 'function') { // if Konva Ellipse
			ellipseInfo = {
				centerX: probe.x(),
				centerY: probe.y(),
				rotationRad: this.toRadians(probe.rotation()),
				radiusX: probe.radiusX(),
				radiusY: probe.radiusY()
			};
		}

		// optimization is to reduce search area to max bounds possible of the ellipse
		var maxRadius = Math.max(ellipseInfo.radiusX, ellipseInfo.radiusY);
		var maxDiameter = 2 * maxRadius;

		var cvSize = maxDiameter * superScale;

		// create an offscreen canvas, if not already done
		if (this._COMPUTE_GS_CANVAS == null) {
			this._COMPUTE_GS_CANVAS = new OffscreenCanvas(cvSize, cvSize);
		}

		var cv = this._COMPUTE_GS_CANVAS;
		// var cv = document.createElement('canvas');
		// if (G_DEBUG) {
		// 	document.body.appendChild(cv);
		// }
		cv.width = cvSize;
		cv.height = cvSize;

		if (cv.width == 0 || cv.height == 0)
			return 0;

		var ctx = cv.getContext('2d');
		ctx.imageSmoothingEnabled = false;

		// since we are reusing the offscreen canvas, we should clear it each time
		// to prevent getting artifacts from previous draws
		ctx.clearRect(0, 0, cv.width, cv.height);

		// draw the image
		// ctx.drawImage(image, 0, 0);
		// optimization, to draw only the necessary area of the image
		ctx.drawImage(image,
			ellipseInfo.centerX - maxRadius,
			ellipseInfo.centerY - maxRadius,
			maxDiameter,
			maxDiameter,
			0,
			0,
			cv.width,
			cv.height);

		// then, set the composite operation
		ctx.globalCompositeOperation = 'destination-in'; //TODO: Is this right? or 'source-in'?

		// then draw the pixel selection shape
		ctx.beginPath();
		ctx.ellipse(
			maxDiameter / 2 * superScale,
			maxDiameter / 2 * superScale,
			ellipseInfo.radiusX * superScale,
			ellipseInfo.radiusY * superScale,
			ellipseInfo.rotationRad,
			0, 2 * Math.PI);
		ctx.fillStyle = 'white';
		ctx.fill();

		// grab the pixel data from the pixel selection area
		var pxData = ctx.getImageData(0,0,cv.width,cv.height);

		// hack to directly use Konva's built-in filters code
		if (typeof Konva != 'undefined') {
			var brightnessFunc = Konva.Filters.Brighten.bind({
				brightness: () => this.getBrightnessInput()});
			var contrastFunc = Konva.Filters.Contrast.bind({
				contrast: () => this.getContrastInput()});
			// apply it directly to out image data before we sample it.
			brightnessFunc(pxData);
			contrastFunc(pxData);
		}

		// compute the average pixel (excluding 0-0-0-0 rgba pixels)
		var pxColor = this.get_avg_pixel_gs(pxData);

		// delete the canvas
		//document.body.removeChild(cv);
		ctx = null;
		cv = null;

		return pxColor;
	},

	/**
	 * Applies Brightness/Contrast (B/C) values to a given Konva stage or drawable.
	 * @param {*} drawable The Konva stage or drawable / drawElement.
	 * @param {*} brightness The brightness value, from -1 to 1.
	 * @param {*} contrast The contrast value, mainly from -100 to 100.
	 */
	applyBrightnessContrast: function(drawable, brightness=0, contrast=0) {
		// cache step is need for filter effects to be visible.
		// https://konvajs.org/docs/performance/Shape_Caching.html
		drawable.cache();

		// Filters: https://konvajs.org/api/Konva.Filters.html
		// Brightness => https://konvajs.org/docs/filters/Brighten.html
		// Contrast => https://konvajs.org/docs/filters/Contrast.html
		var currentFilters = drawable.filters();
		// null check, default to empty array if n/a.
		currentFilters = currentFilters != null ? currentFilters : [];
		// Add filter if not already included...
		var currentFiltersByName = currentFilters.map(x => x.name);
		var filtersToSet = currentFilters;
		var added = 0;
		['Brighten', 'Contrast'].forEach(filterName => {
			if (!currentFiltersByName.includes(filterName)) {
				filtersToSet.push(Konva.Filters[filterName]);
				added++;
			}
		});
		drawable.filters(filtersToSet);
		if (G_DEBUG) {
			console.log("filters added:", added);
		}

		// apply B/C filter values
		drawable.brightness(brightness);
		drawable.contrast(contrast);
	},

	/**
	 * Sets the image Smoothing option for a given stage.
	 * Currently, this only affects the "base" layer.
	 * For now it doesn't make sense to remove smoothing from overlay layers
	 * which are currently used for annotations and such.
	 * @param {*} stage The stage
	 * @param {*} enabled True for enabled, false for disabled
	 */
	setStageImageSmoothing: function(stage, enabled=true){
		var layers = stage.getLayers();

		// if we need / want this for all layers, we could loop over all layers
		if (layers.length > 0) {
			var baseLayer = layers[0];
			baseLayer.imageSmoothingEnabled(enabled);
			// 2024.02.05: imageSmoothingQuality is not yet fully supported...
			// baseLayer.imageSmoothingQuality = 'low';
		}
	},

	/**
	 * Find and gets the first "image" type from the first layer of the given Konva stage
	 * @param {*} stage the stage to search through
	 * @returns the first image object
	 */
	getFirstImageFromStage: function(stage){
		var image = stage.getLayers()[0].getChildren(function(x){
			return x.getClassName() == 'Image';
		})[0];

		return image;
	},

	/**
	 * Creates a new Konva.Rect object based on the position and size of a given konva object.
	 * @param {*} kObject A konva object that has a size and postion, such as a stage, image, or rect.
	 * @returns a rectable object with x, y, width, and height functions.
	 */
	getRectFromKonvaObject: function(kObject){
		return new Konva.Rect({
			x: kObject.x(),
			y: kObject.y(),
			width: kObject.width(),
			height: kObject.height(),
		});
	},

	/**
	 * Finds (non-recusrive) the first layer with a matching on a given stage, null if n/a.
	 * @param {*} stage The stage or element with layers.
	 * @param {*} layerName The name of the layer.
	 */
	getLayerByName: function(stage, layerName){
		var layers = stage.getLayers();
		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const name = layer.name();
			if (name == layerName) {
				return layer;
			}
		}
		return null;
	},

	/**
	 * get the image without the row/draw indicator
	 * @param {*} stage the stage to search through
	 * @returns the image object
	 */
	getVirtualSEM_KonvaImage: function(stage){
		// should be the only "Image" child on the first layer...
		return this.getFirstImageFromStage(stage);
	},

	/**
	 * get the imageData (pixels) from a given konva object/image
	 * @param {*} konvaObject the shape/image/object to get image data from
	 * @param {number} pixelRatio the pixel ratio to scale (larger means ~higher resolution)
	 * @param {boolean} imageSmoothing Set to true to use image smoothing
	 * @returns The image data
	 */
	getKonvaImageData: function(konvaObject, pixelRatio=2, imageSmoothing=true) {
		// TODO: maybe we get higher DPI / density images?
		var cnv = konvaObject.toCanvas({"pixelRatio": pixelRatio, "imageSmoothingEnabled": imageSmoothing});
		var ctx = cnv.getContext('2d');
		var data = ctx.getImageData(0, 0, cnv.width, cnv.height);
		return data;
	},

	/** Displays a message/dialog box with information about this application. */
	ShowAboutMessage: function(){
		/* eslint-disable max-len */
		const id = 'dialog-about';
		var about = $('#'+id);
		if (about.length) {
			about.dialog('open');
		} else {
			var elem = $("<div/>")
			.attr({
				'id': id,
				'title': "About " + G_APP_NAME
			})
			.css({'display':'none'})
			.addClass('jui')
			// fix jquery-ui auto-focus bug: https://stackoverflow.com/a/14748517/883015
			.html(`
			<div>
			<input type="hidden" autofocus="autofocus" />
			<div style="float: left;margin: 0 4px;"><img src="src/img/icon128.png" width="48"></div>
			<p><b>`	+G_APP_NAME+ `</b> was created as an easy-to-use tool to understand the effects of 
			the spot size to pixel size ratio on image clarity and resolution
			in the SEM image formation / rasterization process.</p>
			
			<p><b>Application Development</b></p>
			<ul>
			<li>Main developer: Joachim de Fourestier</li>
			<li>Original concept: Michael W. Phaneuf</li>
			</ul>

			<details open>
			<summary><b>Source Code and Documentation</b></summary>
			<ul>
			<li>Source code: <a href="https://github.com/joedf/ImgBeamer">https://github.com/joedf/ImgBeamer</a></li>
			<li>Code documentation: <a href="https://joedf.github.io/ImgBeamer/jsdocs">https://joedf.github.io/ImgBeamer/jsdocs</a></li>
			<li>Application design: <a href="https://github.com/joedf/CAS741_w23">https://github.com/joedf/CAS741_w23</a></li>
			<li>Quick start guide: <a href="https://joedf.github.io/ImgBeamer/misc/ImgBeamer_QS_guide.pdf">ImgBeamer_QS_guide.pdf</a></li>
			</ul>
			</details>
			
			<details>
			<summary><b>Image Contributions</b></p></summary>
			<ul>
			<li>Bavley Guerguis for the APT needle image <q>APT_needle.png</q></li>
			<li>Joachim de Fourestier for the <q>El Laco tephra (EL-JM-P4)</q> images
			<q>tephra_448nm.png</q>, <q>tephra_200nm.png</q>,
			and the virtual <q>grains</q> images.
			</li>
			</ul>
			<p>All images belong to their respective owners and are used here with permission.</p>
			</details>

			<details>
			<summary><b>Open-Source Libraries</b></p></summary>
			<ul>
			<li><a href="https://konvajs.org">Konva.js</a> - HTML5 2d canvas js library</li>
			<li><a href="https://jquery.com/">jQuery</a>
			and <a href="https://jqueryui.com">jQuery-ui</a> - HTML DOM manipulation and UI elements</li>
			<li><a href="https://github.com/dataarts/dat.gui">dat.gui</a> - Lightweight GUI for changing variables</li>
			<li><a href="https://github.com/photopea/UTIF.js">UTIF.js</a> - Fast and advanced TIFF decoder</li>
			<li><a href="https://github.com/darosh/image-ms-ssim-js">image-ms-ssim.js</a> - Image multi-scale structural similarity (MS-SSIM)</li>
			</ul>
			</details>

			</div>
			`).appendTo('body');

			elem.dialog({
				modal: true,
				width: 540,
				buttons: {
					Ok: function() {
						$( this ).dialog( "close" );
					}
				}
			});
		}
		/* eslint-enable max-len */
	}
};
