/* globals NRMSE */

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

		// antialiasing
		var ctx = layer.getContext();
		ctx.imageSmoothingEnabled = false;

		// add and push
		stage.add(layer);

		return stage;
	},

	/**
	 * Initiates the image resource load with a callback once the image is loaded.
	 * @param {string} url The url pointing to the image to load.
	 * @param {function} callback The callback function to call/run once the image is loaded.
	 */
	loadImage: function(url, callback) {
		var imageObj = new Image();
		imageObj.onload = callback;
		imageObj.src = url;
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

	getRowsInput: function(){ return this.getInputValueInt($('#iRows')); },
	getColsInput: function(){ return this.getInputValueInt($('#iCols')); },
	getCellWInput: function(){ return this.getInputValueInt($('#iCellW')); },
	getCellHInput: function(){ return this.getInputValueInt($('#iCellH')); },
	getSpotXInput: function(){ return this.getInputValueInt($('#iSpotX')); },
	getSpotYInput: function(){ return this.getInputValueInt($('#iSpotY')); },
	getSpotAngleInput: function(){ return this.getInputValueInt($('#iSpotAngle')); },
	getGroundtruthImage: function(){ return $('#sb_groundtruthImage').val(); },

	/**
	 * Creates a Zoom event handler to be used on a stage.
	 * @param {object} stage the drawing stage
	 * @param {*} konvaObj the figure or object on the stage to change.
	 * @param {*} callback a callback for when the zoom event handler is called.
	 * @param {*} scaleFactor the scale factor per "tick"
	 * @param {number|function} scaleMin the scale minimum allowed defined as a number or function.
	 * @param {number|function} scaleMax the scale maximum allowed defined as a number or function.
	 * @returns the created event handler
	 */
	MakeZoomHandler: function(stage, konvaObj, callback=null, scaleFactor=1.2, scaleMin=0, scaleMax=Infinity)
	{
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
	 * Creates a random integer between 0 and the given maximum.
	 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
	 * @param {number} max the largest value possible.
	 * @returns a random number.
	 */
	getRandomInt: function(max) {
		return Math.floor(Math.random() * max);
	},

	// 

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
	updateDisplayBeamParams: function(stage, beam, cellSize, userImage) {
		var infoclass = "parameterDisplay";
		var eStage = $(stage.getContainer());
		var e = eStage.children('.'+infoclass+':first');
		if (e.length < 1) {
			eStage.prepend('<span class="'+infoclass+'"></span>');
			e = eStage.children('.'+infoclass+':first');
		}
		if (e.length > 0) {
			var element = e.get(0);

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

			element.innerHTML = 'Eccentricity: '+eccentricity.toFixed(2) +'<br>'
			+ 'Rotation: '+beam.rotation().toFixed(1)+"°" +'<br>'
			+ 'Width: '+spotSizeX.toFixed(1)+'%' +'<br>'
			+ 'Height: '+spotSizeY.toFixed(1)+'%';
		}
	},

	/**
	 * Calculates cell size based on imageRect, rows and cols
	 * @param {*} image the subregion image object.
	 * @param {number} rows the number of rows to split the subregion into.
	 * @param {number} cols the number of columns to split the subregion into.
	 * @returns the size (w,h) of a cell in the raster grid.
	 */
	computeCellSize: function(image, rows, cols){
		var subregionRect = image.getSelfRect();
		var cellSize = {
			w: subregionRect.width / cols,
			h: subregionRect.height / rows
		};
		return cellSize;
	},

	/** Calculates the magnification based on the given rectangles' width and scaleX */
	computeMagLevel: function(rectBase, rectScaled) {
		var rW = (rectScaled.width() * rectScaled.scaleX()) / (rectBase.width() * rectBase.scaleX());
		return rW;
	},

	/** Display magnification */
	updateMagInfo: function(destStage, scaledRect) {
		var magLevel = this.computeMagLevel(scaledRect.getStage(), scaledRect);
		var fmtMag = magLevel.toFixed(2) + 'X';

		// add/update the mag disp. text
		// TODO: this is smiliar/duplicate code from updateDisplayBeamParams()
		var infoclass = "magDisplay";
		var eStage = $(destStage.getContainer());
		var e = eStage.children('.'+infoclass+':first');
		if (e.length < 1) {
			eStage.prepend('<span class="'+infoclass+'"></span>');
			e = eStage.children('.'+infoclass+':first');
		}
		if (e.length > 0) {
			var element = e.get(0);
			element.innerHTML = fmtMag;
		}
	},

	/** Display Image metrics */
	updateImageMetricsInfo: function(sourceStage, destStage) {
		// get ground truth image
		var refImage = this.getFirstImageFromStage(sourceStage);
		var refData = this.getKonvaImageData(refImage);

		// get the image without the row/draw indicator
		var finalImage = this.getVirtualSEM_KonvaImage(destStage);
		var finalData = this.getKonvaImageData(finalImage);

		// Do the metric calculation here
		var metrics = NRMSE.compare(refData, finalData);

		// display it
		// TODO: this is smiliar/duplicate code from updateDisplayBeamParams()
		var infoclass = "metricsDisplay";
		var eStage = $(destStage.getContainer());
		var e = eStage.children('.'+infoclass+':first');
		if (e.length < 1) {
			eStage.prepend('<span class="'+infoclass+'"></span>');
			e = eStage.children('.'+infoclass+':first');
		}
		if (e.length > 0) {
			var element = e.get(0);
			element.innerHTML = "iNRMSE = " + metrics.inrmse.toFixed(4);
		}
	},

	fitImageProportions: function(w, h, maxDimension, doFill=false){
		// image ratio to "fit" in canvas
		var ratio = (w > h ? (w / maxDimension) : (h / maxDimension)); // fit
		if (doFill){
			ratio = (w > h ? (h / maxDimension) : (w / maxDimension)); // fill
		}

		var iw = w/ratio; //, ih = h/ratio;
		return {w: iw, h: iw};
	},

	/** scales the given shape, and moves it to preserve original center */
	scaleOnCenter: function(stage, shape, oldScale, newScale){
		var stageCenter = {
			/* eslint-disable no-magic-numbers */
			x: stage.width()/2 - stage.x(),
			y: stage.height()/2 - stage.y()
			/* eslint-enable no-magic-numbers */
		};
		return this.scaleCenteredOnPoint(stageCenter, shape, oldScale, newScale);
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
	 * @param {*} rows the number of rows in the grid.
	 * @param {*} cols the number of columns in the grid.
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
	
		const xSize= gridLayer.width(), // stage.width(), 
				ySize= gridLayer.height(), // stage.height(),
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

	// originally based from drawGrid() ...
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

	computeResampledPreview: function(previewStage, image, probe, rows, cols, rect){
		var previewLayer = previewStage.getLayers()[0];
		previewLayer.destroyChildren();

		var gr = image.clone();
		gr.globalCompositeOperation(COMPOSITE_OP);

		this.repeatDrawOnGrid(previewLayer, rect, probe, rows, cols);
		previewLayer.add(gr);
	},

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
	 * Essentially, this is computeResampleFast(), but corrected for spot size larger than the cell size
	 * ComputeResampleFast() is limits the sampling to the cell size, and takes in smaller version of the
	 * image that is already drawn and "compositied" in a Konva Stage, instead of the original larger image...
	 */
	computeResampledSlow: function(sourceStage, destStage, oImage, probe, rows, cols, rect){
		var destLayer = destStage.getLayers()[0];
		destLayer.destroyChildren(); 

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

		// interate over X
		for (let i = 0; i < cols; i++) {
			// interate over Y
			for (let j = 0; j < rows; j++) {
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

	/** Converts an angle in radians to degrees */
	toDegrees: function(angle) { return angle * (180 / Math.PI); },

	/** Converts an angle in degrees to radians */
	toRadians: function(angle) { return angle * (Math.PI / 180); },

	/** Gets the average pixel value (grayscale intensity) with a given image and probe.
	 * @param {number} superScale factor to scale up ("blow-up") the image for the sampling */
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

		var cv = document.createElement('canvas');
		if (G_DEBUG) {
			document.body.appendChild(cv);
		}
		cv.width = maxDiameter * superScale;
		cv.height = maxDiameter * superScale;

		if (cv.width == 0 || cv.height == 0)
			return 0;

		var ctx = cv.getContext('2d');
		ctx.imageSmoothingEnabled = false;

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
		ctx.globalCompositeOperation = 'destination-in';

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

		// compute the average pixel (excluding 0-0-0-0 rgba pixels)
		var pxColor = this.get_avg_pixel_gs(pxData);

		// delete the canvas
		//document.body.removeChild(cv);
		ctx = null;
		cv = null;

		return pxColor;
	},

	/** gets the first "image" type from the first layer of the given Konva stage */
	getFirstImageFromStage: function(stage){
		var image = stage.getLayers()[0].getChildren(function(x){
			return x.getClassName() == 'Image';
		})[0];

		return image;
	},

	/** get the image without the row/draw indicator */
	getVirtualSEM_KonvaImage: function(stage){
		// should be the only "Image" child on the first layer...
		return this.getFirstImageFromStage(stage);
	},

	/** get the imageData (pixels) from a given konva object/image */
	getKonvaImageData: function(konvaObject, pixelRatio) {
		pixelRatio = (typeof pixelRatio !== "undefined") ? pixelRatio : 2;
		// TODO: maybe we get higher DPI / density images?
		var cnv = konvaObject.toCanvas({"pixelRatio": pixelRatio});
		var ctx = cnv.getContext('2d');
		var data = ctx.getImageData(0, 0, cnv.width, cnv.height);
		return data;
	}
};
