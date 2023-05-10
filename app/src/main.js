/* globals Utils, GetOptimalBoxWidth */

// global functions from drawsteps.js
/* globals
 drawSpotProfileEdit, drawSubregionImage, drawSpotContent, drawSpotSignal,
 drawProbeLayout, drawProbeLayoutSampling, drawResampled, drawGroundtruthImage,
 drawVirtualSEM
 */

/* exported G_UpdateResampled, G_UpdateVirtualSEMConfig, ResampleFullImage */

var G_DEBUG = false;

Konva.autoDrawEnabled = true;

/** The number of cells in the raster grid at which auto-preview stops, for responsiveness */
// eslint-disable-next-line no-magic-numbers
var G_AUTO_PREVIEW_LIMIT = Infinity;// 16 * 16;

var G_VSEM_PAUSED = false;

/** global variable to set the input ground truth image */
// var G_INPUT_IMAGE = Utils.getGroundtruthImage();
var G_INPUT_IMAGE = 'src/testimages/grains2tl.png';

/** global reference to update the resampling steps (spot layout,
 * sampled subregion, resulting subregion) displays,
 * This is mainly to be called when the auto-preview is disabled/off */
var G_UpdateResampled = null;

/** global reference to update the beam values for the Virtual SEM view */
var G_UpdateVirtualSEMConfig = null;


/** a global reference to the main body container that holds the boxes/stages.
 * @todo do we still need this? Maybe remove... */
var G_MAIN_CONTAINER = $('#main-container');


/** The calculated size of each box/stage */
var G_BOX_SIZE = GetOptimalBoxWidth();

/** The number of stages to create */
const nStages = 9;

// first create the stages
var stages = [];
for (let i = 0; i < nStages; i++) {
	var stage = Utils.newStageTemplate(G_MAIN_CONTAINER, G_BOX_SIZE, G_BOX_SIZE);
	stages.push(stage);
}

/////////////////////

/**Currently only used by {@link ResampleFullImage}
 * @todo Possibly, to be removed along with it. */
var G_MAIN_IMAGE_OBJ = null;

// call once on App start
UpdateBaseImage();

// update event for ground truth image change
$(document.body).on('OnGroundtruthImageChange', UpdateBaseImage);

/** Updates everything needed assuming that {@link G_INPUT_IMAGE} has changed,
 * updates/draws all the stages/boxes once. */
function UpdateBaseImage(){
	// load image and wait for when ready
	Utils.loadImage(G_INPUT_IMAGE, function(event){
		var imageObj = event.target;
		G_MAIN_IMAGE_OBJ = imageObj;
		
		OnImageLoaded(imageObj, stages);
	});
}

/**
 * Called by {@link UpdateBaseImage} once the image data has been loaded,
 * Draws and manages all the drawing stages with each their event handlers.
 * @param {*} eImg The Element/Object of the loaded image.
 * @param {*} stages The array of stages to use for drawing.
 */
function OnImageLoaded(eImg, stages){
	/* eslint-disable no-magic-numbers */
	// Edit these numbers to change the display order
	var baseImageStage = stages[1];
	var spotProfileStage = stages[2];
	var spotContentStage = stages[3];
	var spotSignalStage = stages[4];
	var probeLayoutStage = stages[5];
	var layoutSampledStage = stages[6];
	var resampledStage = stages[7];
	var groundtruthMapStage = stages[0];
	var virtualSEMStage = stages[8];
	/* eslint-enable no-magic-numbers */

	/** called when a change occurs in the spot profile, subregion, or spot content */
	function doUpdate(){
		if ($(spotSignalStage.getContainer()).is(':visible')) {
			updateSpotSignal();
		}
		updateProbeLayout();
		updateResamplingSteps(true);
		updateGroundtruthMap();
		updateVirtualSEM_Config();

		// update spot/beam info: size, rotation, shape
		var cellSize = Utils.computeCellSize(probeLayout.image, Utils.getRowsInput(), Utils.getColsInput());
		Utils.updateDisplayBeamParams(spotProfileStage, layoutBeam, cellSize, spotScaling, promptForSpotWidth);
		Utils.updateMagInfo(baseImageStage, subregionImage);
		Utils.updateImageMetricsInfo(groundtruthMapStage, virtualSEMStage);
	}

	/** prompts the user for the spot width % */
	function promptForSpotWidth(){
		var spotWidth = prompt("Spot width (%) - Default is 100%", 100, 0);
		if (spotWidth > 0) {
			Utils_SetSpotWidth(spotWidth);
		}
	}

	// draw Spot Profile
	$(spotProfileStage.getContainer())
		.attr('box_label', 'Spot Profile')
		.attr('note', 'Press [R] to reset shape')
		.css('border-color', 'red');
	var _spotProfileInfo = drawSpotProfileEdit(spotProfileStage, doUpdate);
	var beam = _spotProfileInfo.beam;
	var spotScaling = _spotProfileInfo.spotSize;

	// Subregion View
	// draw base image (can pan & zoom)
	$(baseImageStage.getContainer())
		.addClass('grabCursor')
		.attr('box_label', 'Subregion/ROI View')
		.attr('note', 'Pan & Zoom: Drag and Scroll\nPress [R] to reset')
		.css('border-color', 'blue');
	var subregionImage = drawSubregionImage(baseImageStage, eImg, G_BOX_SIZE, false, doUpdate);

	// make a clone without copying over the event bindings
	var image = subregionImage.clone().off();

	// draw Spot Content
	$(spotContentStage.getContainer())
		.addClass('advancedMode').hide()
		.addClass('grabCursor')
		.attr('box_label', 'Spot Content')
		.attr('note', 'Scroll to adjust spot size\nHold [Shift] for half rate');
	var spotContentBeam = beam.clone();
	drawSpotContent(spotContentStage, image, spotContentBeam, doUpdate);

	/**(temporary) publicly exposed function to set the spot width
	 * @param {number} spotWidth the spot width in percent (%), ex. use 130 for 130%.
	 * @todo move into separate file if possible */
	function Utils_SetSpotWidth(spotWidth=100){
		var beam = spotContentBeam;
		var spotScaler = spotScaling;
		
		// calculate the new scale for spot-content image, based on the given spot width
		var cellSize = Utils.computeCellSize(spotScaler, Utils.getRowsInput(), Utils.getColsInput());
		var maxScale = Math.max(beam.scaleX(), beam.scaleY());
		var eccScaled = beam.scaleX() / maxScale;
		var newScale = ((beam.width() * eccScaled) / (spotWidth/100)) / cellSize.w;

		Utils.centeredScale(spotScaler, newScale);

		// propagate changes and update stages
		updateBeams();
		doUpdate();
	}

	// draw Spot Signal
	$(spotSignalStage.getContainer())
		.addClass('advancedMode').hide()
		.addClass('note_colored')
		.attr('box_label', '(Integrated) Spot Signal');
	var spotSignalBeam = beam.clone();
	var updateSpotSignal = drawSpotSignal(spotContentStage, spotSignalStage, spotSignalBeam);

	// draw Spot Layout
	$(probeLayoutStage.getContainer()).attr('box_label', 'Spot Layout');
	var layoutBeam = beam.clone();
	var probeLayout = drawProbeLayout(probeLayoutStage, subregionImage, spotScaling, layoutBeam);
	var updateProbeLayout = probeLayout.updateCallback;
	
	// draw Sampled Subregion
	// compute resampled image
	$(layoutSampledStage.getContainer())
		.addClass('advancedMode').hide()
		.attr('box_label', 'Sampled Subregion');
	var layoutSampledBeam = beam.clone();
	var updateProbeLayoutSamplingPreview = drawProbeLayoutSampling(
		layoutSampledStage,
		probeLayout.image,
		spotScaling,
		layoutSampledBeam
	);

	// draw Resulting Subregion
	$(resampledStage.getContainer())
		.attr('box_label', 'Resulting Subregion')
		.css('border-color', 'lime');
	var resampledBeam = beam.clone();
	var updateResampled = drawResampled(
		layoutSampledStage,
		resampledStage,
		probeLayout.image,
		spotScaling,
		resampledBeam
	);
	
	var updateResamplingSteps = function(internallyCalled=false){
		var rows = Utils.getRowsInput();
		var cols = Utils.getColsInput();

		if (internallyCalled && (rows*cols > G_AUTO_PREVIEW_LIMIT)) {
			console.warn('automatic preview disable for 64+ grid cells.');
			return;
		}

		updateProbeLayout();
		if ($(layoutSampledStage.getContainer()).is(':visible')) {
			updateProbeLayoutSamplingPreview();
		}
		updateResampled();
	};
	G_UpdateResampled = updateResamplingSteps;

	// draw Sample Ground Truth
	$(groundtruthMapStage.getContainer()).attr('box_label', 'Sample Ground Truth');
	var groundtruthMap = drawGroundtruthImage(groundtruthMapStage, eImg, subregionImage, G_BOX_SIZE);
	var updateGroundtruthMap = groundtruthMap.updateFunc;
	
	// draw Resulting Image
	$(virtualSEMStage.getContainer()).attr('box_label', 'Resulting Image');
	var vitualSEMBeam = beam.clone();
	var updateVirtualSEM_Config = drawVirtualSEM(
		virtualSEMStage,
		vitualSEMBeam,
		groundtruthMap.subregionRect,
		groundtruthMapStage,
		eImg,
		spotScaling
	);
	G_UpdateVirtualSEMConfig = updateVirtualSEM_Config;

	/** propagate changes to the spot-profile (beam) to the beams in the other stages */
	function updateBeams(){
		spotContentBeam.scale(beam.scale());
		spotContentBeam.rotation(beam.rotation());
		spotSignalBeam.scale(beam.scale());
		spotSignalBeam.rotation(beam.rotation());

		// keep the shape of the ellipse, not the actual size of it...
		var maxScale = Math.max(beam.scaleX(), beam.scaleY());
		layoutBeam.size({
			width: beam.width() * (beam.scaleX() / maxScale),
			height: beam.height() * (beam.scaleY() / maxScale),
		});
		layoutBeam.rotation(beam.rotation());

		layoutSampledBeam.size(layoutBeam.size());
		layoutSampledBeam.rotation(layoutBeam.rotation());
		
		resampledBeam.size(layoutBeam.size());
		resampledBeam.rotation(layoutBeam.rotation());

		vitualSEMBeam.size(layoutBeam.size());
		vitualSEMBeam.rotation(layoutBeam.rotation());
	}

	// update beams
	beam.off('transform'); // prevent "eventHandler doubling" from subsequent calls
	beam.on('transform', function(){
		updateBeams();
		doUpdate();
	});

	doUpdate();
}

/** Draws the full resample image given the parameters in the GUI and logs
 * the progress in the webconsole. Very heavy and slow. Could may be optimized
 * with an offscreenCanvas and webworkers...
 * @todo Maybe no longer needed and can be removed?
 */
function ResampleFullImage() {
	var image = G_MAIN_IMAGE_OBJ;

	if (image == null) {
		alert('image is not loaded yet. Please wait and try again in a few moments.');
		return;
	}

	var eStatus = document.querySelector('#status');

	var StartTime = Date.now();
	let msg = 'ResampleFullImage Start: '+ (new Date(StartTime)).toString();
	console.log(msg);
	eStatus.innerHTML = msg;

	var iw = image.naturalWidth, ih = image.naturalHeight;

	// calculate grid layout
	var pixelSizeX = Utils.getCellWInput(); // px
	var pixelSizeY = Utils.getCellHInput(); // px
	var cols = Math.floor(iw / pixelSizeX);
	var rows = Math.floor(ih / pixelSizeY);

	// cell half width/height
	var cell_half_W = pixelSizeX / 2;
	var cell_half_H = pixelSizeY / 2;

	// spot size ratio
	var spot_rX = Utils.getSpotXInput(); // %
	var spot_rY = Utils.getSpotYInput(); // % 

	// probe radii
	var probe_rX = (pixelSizeX/2) * (spot_rX / 100);
	var probe_rY = (pixelSizeY/2) * (spot_rY / 100);
	var probe_rotationRad = Utils.toRadians(Utils.getSpotAngleInput());

	// prep result canvas, if not already there
	var cv = document.querySelector('#finalCanvas');
	if (cv == null) {
		cv = document.createElement('canvas');
		cv.id = 'finalCanvas';
		cv.width = cols; cv.height = rows;
		var cc = $('<div/>').addClass('box final').appendTo(G_MAIN_CONTAINER); cc.append(cv);
	}

	cv.width = cols;
	cv.height = rows;

	// get context
	var ctx = cv.getContext('2d');

	// clear the canvas
	ctx.clearRect(0, 0, cv.width, cv.height);

	// row pixels container array
	// number of pixels (rows, cols) * 4 (components: RGBA)
	var pixels = new Uint8ClampedArray(rows * cols * 4);
	var count = 0;

	// process and compute each pixel grid cell
	for (let i = 0; i < rows; i++) {

		// compute pixel value and push to matrix
		for (let j = 0; j < cols; j++) {
			const probe = {
				centerX: (j * pixelSizeX) + cell_half_W,
				centerY: (i * pixelSizeY) + cell_half_H,
				radiusX: probe_rX,
				radiusY: probe_rY,
				rotationRad: probe_rotationRad
			};
			
			// compute pixel value - greyscale
			const pixel = Utils.ComputeProbeValue_gs(image, probe);

			// console.info(pixel);

			// push pixel to array - RGBA values
			pixels[count+0] = pixel;
			pixels[count+1] = pixel;
			pixels[count+2] = pixel;
			pixels[count+3] = 255;

			count += 4;
		}

		let msg = 'computed row: '+(i+1)+' / '+rows;
		console.log(msg);
		// eStatus.innerHTML = msg;

		
		// drawing the image row by row
		if (G_DEBUG)
			console.log('ResampleFullImage drew row: '+(i+1)+' / '+rows);

		/*
		// free memory
		pixels = null;
		imageData = null;
		*/
	}

	let imageData = new ImageData(pixels, cols); // rows/height is auto-calculated
	ctx.putImageData(imageData, 0, 0);

	var Elapsed = Date.now() - StartTime;
	const second = 1000; //ms
	msg = 'ResampleFullImage End: took '+ Math.floor(Elapsed / second).toString()+" seconds.";
	console.log(msg);
	eStatus.innerHTML = msg;
}