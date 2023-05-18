// partially based on the example from:
// https://konvajs.org/docs/sandbox/Web_Worker.html

// load konva framework
// importScripts('https://unpkg.com/konva@9/konva.min.js');
// importScripts('./3rd-party/konva/konva.min.js');
importScripts('./utils.js');

/* globals Utils */

var G_DRAW_WITH_OVERLAP = true;
var G_DRAW_OVERLAP_PIXELS = 1;
var G_DRAW_OVERLAP_THRESHOLD = 10 * 10;
var G_DRAW_OVERLAP_PASSES = 1;
var G_MIN_AVG_SIGNAL_VALUE = 2;


var canvas = new OffscreenCanvas(1, 1);
var ctx = canvas.getContext('2d');

var originalImageObj = null;
var irw = 1, irh = 1;

var stageWidth = 1, stageHeight = 1;

var rows = 0, cols = 0;
var cellW = 0, cellH = 0;

var beamRadius = {x: 1, y: 1};
var beamRotation = 0;

var pixelCount = 1;
var superScale = 1;
var currentRow = 0;
var currentDrawPass = 0;

var baseImageData = null;


self.onmessage = function (evt) {
	// when canvas is passes we can start our worker
	// we can try to use that canvas for the layer with some manual replacement (and probably better performance)
	// but for simplicity we will just copy layer content into passed canvas
	if (evt.data.canvas) {
		canvas = evt.data.canvas;
		ctx = canvas.getContext('2d');
		ctx.imageSmoothingEnabled = false;
		//ctx.willReadFrequently = true;

		updateDraw();
	}

	if (evt.data.imgData) {
		baseImageData = evt.data.imgData;

		irw = baseImageData.width / stageWidth;
		irh = baseImageData.height / stageHeight;
	}

	if (evt.data == "clearCanvas") {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		currentRow = 0;
		currentDrawPass = 0;
	}

	if (evt.data.config) {
		var cfg = evt.data.config;
		rows = cfg.rows;
		cols = cfg.cols;
		stageWidth = cfg.stageWidth;
		stageHeight = cfg.stageHeight;
		cellW = cfg.cellSize.w;
		cellH = cfg.cellSize.h;
		beamRadius = cfg.beamRadius;
		beamRotation = cfg.beamRotation;
	}
};

var updateDraw = function(){
	// ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (baseImageData != null) {
		// ctx.putImageData(baseImageData, 0, 0);
	}
	


	// track time to draw the row
	var timeRowStart = Date.now();

	var row = currentRow++;

	if (currentRow >= rows) {
		currentRow = 0;
		currentDrawPass += 1;
	}

	var rowIntensitySum = 0;

	// interate over X
	for (let i = 0; i < cols; i++) {
		const cellX = i * cellW;
		const cellY = row * cellH;

		// map/transform values to full resolution image coordinates
		const scaledProbe = {
			centerX: (cellX + cellW/2) * irw,
			centerY: (cellY + cellH/2) * irh,
			rotationRad: Utils.toRadians(beamRotation),
			radiusX: beamRadius.x * irw,
			radiusY: beamRadius.y * irh,
		};

		// compute the pixel value, for the given spot/probe profile
		// var gsValue = Utils.ComputeProbeValue_gs(originalImageObj, scaledProbe, superScale);
		// var color = 'rgba('+[gsValue,gsValue,gsValue].join(',')+',1)';
		var gsValue = 128;
		var colors = ['#DDDDDD','#EEEEEE','#CCCCCC','#999999','#666666','#333333','#B6B6B6','#1A1A1A'];
		var color = colors[Utils.getRandomInt(colors.length)];

		ctx.fillStyle = color;

		rowIntensitySum += gsValue;

		// optionally, draw with overlap to reduce visual artifacts
		if ((currentDrawPass < G_DRAW_OVERLAP_PASSES)
		&& (G_DRAW_WITH_OVERLAP && pixelCount >= G_DRAW_OVERLAP_THRESHOLD)) {
			ctx.fillRect(
				cellX -G_DRAW_OVERLAP_PIXELS,
				cellY -G_DRAW_OVERLAP_PIXELS,
				cellW +G_DRAW_OVERLAP_PIXELS,
				cellH +G_DRAW_OVERLAP_PIXELS
			);
		} else {
			ctx.fillRect(cellX, cellY, cellW, cellH);
		}
	}

	// if the last drawn was essentially completely black
	// assume the spot size was too small or no signal
	// for 1-2 overlapped-draw passes...
	var rowIntensityAvg = rowIntensitySum / cols;
	if (rowIntensityAvg <= G_MIN_AVG_SIGNAL_VALUE) { // out of 255
		currentDrawPass = -1;
	}

	// move/update the indicator
	// indicator.y((row+1) * cellH - indicator.height());

	// use this for debugging, less heavy, draw random color rows
	// color = colors[Utils.getRandomInt(colors.length)];
	// updateConfigValues();

	var timeDrawTotal = Date.now() - timeRowStart;
	// stage.getContainer().setAttribute('note', timeDrawTotal + " ms/Row");


	requestAnimationFrame(updateDraw);
};