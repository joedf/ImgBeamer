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

function createOffscreenStage(width, height, layers) {
	// create canvas
	var canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	// create Konva stage
	var stage = new Konva.Stage({
		container: canvas,
		width: width,
		height: height
	});

	// then create layers and to stage
	for (let i = 0; i < layers; i++) {
		var layer = new Konva.Layer({
			listening: false // faster render
		});

		// antialiasing
		var ctx = layer.getContext();
		ctx.imageSmoothingEnabled = false;

		// add and push
		stage.add(layer);
	}

	return stage;
}

function getInputValueInt($e){
	var v = parseInt($e.val());
	if (isNaN(v))
		return parseInt($e.attr('placeholder'));
	return v;
}

function getRowsInput(){ return getInputValueInt($('#iRows')); }
function getColsInput(){ return getInputValueInt($('#iCols')); }

// scales the give shape, and moves it to preserve original center
function scaleOnCenter(stage, shape, oldScale, newScale){
	// could be expanded to do both x and y scaling
	shape.scale({x: newScale, y: newScale});
	var stageCenter = {
		x: stage.width()/2 - stage.x(),
		y: stage.height()/2 - stage.y()
	};
	var oldPos = {
		x: (stageCenter.x - shape.x()) / oldScale,
		y: (stageCenter.y - shape.y()) / oldScale,
	};
	shape.position({
		x: stageCenter.x - oldPos.x * newScale,
		y: stageCenter.y - oldPos.y * newScale,
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
	console.log(blanks, total, percent);
	console.log("avg px=", avg.toString());

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

	var avg = sum / fills;
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


function computeResampledPreview(previewStage, processingStage, image, probe, rows, cols){
	var previewLayer = previewStage.getLayers()[0];
	previewLayer.destroyChildren();

	var gr = image.clone();
	gr.globalCompositeOperation(COMPOSITE_OP);

	repeatDrawOnGrid(previewLayer, image, probe, rows, cols);
	previewLayer.add(gr);
}

function computeResampled(sourceStage, destStage, image, probe, rows, cols){
	var destLayer = destStage.getLayers()[0];
	destLayer.destroyChildren(); 

	var layer = sourceStage.getLayers()[0];
	layer.cache();
	var ctx = layer.getContext();


	var lRatio = ctx.canvas.pixelRatio;

	
	// process each grid cell
	var startX = image.x(), startY = image.y();
	var stepSizeX = image.width() / cols, stepSizeY = image.height() / rows;

	var test = 0;

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

			if (!test) {
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

	if (test) {
		drawGrid(destLayer, image, rows, cols);
	}
}