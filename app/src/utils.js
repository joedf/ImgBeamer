// makes a new stage with a layer added, and some settings
function newStageTemplate(parentContainer, w, h) {
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
}

function loadImage(url, callback) {
	var imageObj = new Image();
	imageObj.onload = callback;
	imageObj.src = INPUT_IMAGE;
}

function getInputValueInt($e){
	var v = parseInt($e.val());
	if (isNaN(v))
		return parseInt($e.attr('placeholder'));
	return v;
}

function getRowsInput(){ return getInputValueInt($('#iRows')); }
function getColsInput(){ return getInputValueInt($('#iCols')); }
function getCellWInput(){ return getInputValueInt($('#iCellW')); }
function getCellHInput(){ return getInputValueInt($('#iCellH')); }
function getSpotXInput(){ return getInputValueInt($('#iSpotX')); }
function getSpotYInput(){ return getInputValueInt($('#iSpotY')); }
function getSpotAngleInput(){ return getInputValueInt($('#iSpotAngle')); }
function getSEMRefreshDelay(){ return getInputValueInt($('#iDelaySEM')); }
function getGroundtruthImage(){ return $('#sb_groundtruthImage').val(); }

function MakeZoomHandler(stage, konvaObj, callback=null, scaleFactor=1.2, scaleMin=0, scaleMax=Infinity) {
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
			scaleCenteredOnPoint(pointer, konvaObj, oldScale, finalScale);
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
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function getRandomInt(max) {
	return Math.floor(Math.random() * max);
}

function updateDisplayBeamParams(stage, beam, cellSize, userImage) {
	var infoclass = "parameterDisplay";
	var eStage = $(stage.getContainer());
	var e = eStage.children('.'+infoclass+':first');
	if (e.length < 1) {
		eStage.prepend('<span class="'+infoclass+'"></span>');
		e = eStage.children('.'+infoclass+':first');
	}
	if (e.length > 0) {
		var element = e.get(0);

		var a = beam.radiusX() * beam.scaleX(), b = beam.radiusY() * beam.scaleY();
		if (a < b) { [a, b] = [b, a] } // swap
		// https://www.cuemath.com/geometry/eccentricity-of-ellipse/
		var eccentricity = Math.sqrt(1 - (Math.pow(b,2) / Math.pow(a,2)));

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
}

// calculates cell size based on imageRect, rows and cols
function computeCellSize(image, rows, cols){
	var subregionRect = image.getSelfRect();
	var cellSize = {
		w: subregionRect.width / cols,
		h: subregionRect.height / rows
	};
	return cellSize;
}

// Calculates the magnification based on the given rectangles' width and scaleX
function computeMagLevel(rectBase, rectScaled) {
	var rW = (rectScaled.width() * rectScaled.scaleX()) / (rectBase.width() * rectBase.scaleX());
	return rW;
}

// Display magnification
function updateMagInfo(destStage, scaledRect) {
	var magLevel = computeMagLevel(scaledRect.getStage(), scaledRect);
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
}

function fitImageProportions(w, h, maxDimension, doFill=false){
	// image ratio to "fit" in canvas
	var ratio = (w > h ? (w / maxDimension) : (h / maxDimension)) // fit
	if (doFill){
		ratio = (w > h ? (h / maxDimension) : (w / maxDimension)) // fill
	}

	var iw = w/ratio, ih = h/ratio;
	return {w: iw, h: iw};
}

// scales the give shape, and moves it to preserve original center
function scaleOnCenter(stage, shape, oldScale, newScale){
	var stageCenter = {
		x: stage.width()/2 - stage.x(),
		y: stage.height()/2 - stage.y()
	};
	return scaleCenteredOnPoint(stageCenter, shape, oldScale, newScale);
}

function scaleCenteredOnPoint(point, shape, oldScale, newScale){
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
}

function get_avg_pixel_rgba(raw) {
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
}

function get_avg_pixel_gs(raw) {
	var blanks = 0;
	var d = raw.data;

	var sum = 0;

	// Optimization note, with greyscale we only need to process one component...
	for (var i = 0; i < d.length; i += 4) {
		const px = d[i];
		const a = d[i+3];

		if (px === 0 && a === 0) {
			blanks += 1;
		} else {
			sum += px;
		}
	}

	var total = raw.width * raw.height;
	var fills = Math.max(1, total - blanks);

	var avg = Math.round(sum / fills);
	
	return avg;
}

// based on solution1 from:
// https://longviewcoder.com/2021/12/08/konva-a-better-grid/
function drawGrid(gridLayer, rect, rows, cols, lineColor) {

	if (typeof lineColor == 'undefined' || lineColor == null || lineColor.length < 1)
		lineColor = 'rgba(255, 255, 255, 0.8)';

	var startX = rect.x();
	var startY = rect.y();

	var stepSizeX = rect.width() / cols;
	var stepSizeY = rect.height() / rows;
 
	const xSize= gridLayer.width(), // stage.width(), 
			ySize= gridLayer.height(), // stage.height(),
			xSteps = cols; //Math.round(xSize/ stepSizeX), 
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
}

// originally based from drawGrid() ...
function repeatDrawOnGrid(layer, rect, shape, rows, cols) {
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
}


function computeResampledPreview(previewStage, image, probe, rows, cols, rect){
	var previewLayer = previewStage.getLayers()[0];
	previewLayer.destroyChildren();

	var gr = image.clone();
	gr.globalCompositeOperation(COMPOSITE_OP);

	repeatDrawOnGrid(previewLayer, rect, probe, rows, cols);
	previewLayer.add(gr);
}

function computeResampledFast(sourceStage, destStage, image, probe, rows, cols){
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
				// var avgPx = get_avg_pixel_rgba(pxData);
				// var avgColor = "rgba("+ avgPx.join(',') +")";
				var avg = get_avg_pixel_gs(pxData);
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
		drawGrid(destLayer, image, rows, cols);
	}
}

// Essentially, this is computeResampleFast(), but corrected for spot size larger than the cell size
// ComputeResampleFast() is limits the sampling to the cell size, and takes in smaller version of the
// image that is already drawn and "compositied" in a Konva Stage, instead of the original larger image...
function computeResampledSlow(sourceStage, destStage, oImage, probe, rows, cols, rect){
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

			var avg = ComputeProbeValue_gs(image, probe);
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
}

function toDegrees (angle) { return angle * (180 / Math.PI); }
function toRadians (angle) { return angle * (Math.PI / 180); }

// Gets the average pixel value with a given image and probe.
// superScale factor to scale up ("blow-up") the image for the sampling
function ComputeProbeValue_gs(image, probe, superScale=1) {
	var iw = image.naturalWidth, ih = image.naturalHeight;

	// get ellipse info
	var ellipseInfo = probe;
	if (typeof probe.getStage == 'function') { // if Konva Ellipse
		ellipseInfo = {
			centerX: probe.x(),
			centerY: probe.y(),
			rotationRad: toRadians(probe.rotation()),
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
	var pxColor = get_avg_pixel_gs(pxData);

	// delete the canvas
	//document.body.removeChild(cv);
	ctx = null;
	cv = null;

	return pxColor;
}
