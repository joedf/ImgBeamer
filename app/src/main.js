/* globals Utils */

var G_DEBUG = false;
var G_AUTO_PREVIEW_LIMIT = 16 * 16;

// used by "Resulting Image" box / drawVirtualSEM()
// to reduce artifacts from drawing pixel-by-pixel in canvas
var G_DRAW_WITH_OVERLAP = true;
// overlap amount in pixels to all edges (top, left, right, bottom)
var G_DRAW_OVERLAP_PIXELS = 1;
// Optionally draw with overlap when above a certain pixel (cell) count
// set to 0 to essentially ignore this threshold value...
var G_DRAW_OVERLAP_THRESHOLD = 10 * 10; // rows * cols
// Optionally, to draw normally (w/o overlap) after a number of passes
var G_DRAW_OVERLAP_PASSES = 1;
// The minimum average pixel/signal value for an image to be considered "non-blank"
var G_MIN_AVG_SIGNAL_VALUE = 2;

// const G_INPUT_IMAGE = 'src/testimages/grains2tl.png';
var G_INPUT_IMAGE = Utils.getGroundtruthImage();
const COMPOSITE_OP = 'source-in';
// const COMPOSITE_OP = 'destination-in';
var G_UpdateResampled = null;
var G_UpdateVirtualSEMConfig = null;
var G_VirtualSEM_animationFrameRequestId = null;

const G_MAIN_CONTAINER = '#main-container';

Konva.autoDrawEnabled = true;

// the pixel size of the spot used for the subregion render view, updated elsewhere
var G_BEAMRADIUS_SUBREGION_PX = {x:1,y:1};

const nStages = 9;
var boxesPerPageWidth = 5;
var boxBorderW = 2 * (parseInt($('.box:first').css('border-width')) || 1);
var scrollBarW = 15;
// make sure to have an integer value to prevent slight sizing differences between each box
var G_BoxSize = Math.ceil(Math.max((document.body.clientWidth / boxesPerPageWidth) - boxBorderW - scrollBarW, 300));
var G_MainContainer = $(G_MAIN_CONTAINER);


// first create the stages
var stages = [];
for (let i = 0; i < nStages; i++) {
	var stage = Utils.newStageTemplate(G_MainContainer, G_BoxSize, G_BoxSize);
	stages.push(stage);
}

/////////////////////

var G_MAIN_IMAGE_OBJ = null;

// call once on App start
UpdateBaseImage();

// update event for ground truth image change
$(document.body).on('OnGroundtruthImageChange', UpdateBaseImage);

// once the image is loaded, updates/draws all the stages/boxes
function UpdateBaseImage(){
	// load image and wait for when ready
	Utils.loadImage(G_INPUT_IMAGE, function(event){
		var imageObj = event.target;
		G_MAIN_IMAGE_OBJ = imageObj;
		
		OnImageLoaded(imageObj, stages);
	});
}

function OnImageLoaded(eImg, stages){
	var baseImageStage = stages[1];
	var baseBeamStage = stages[2];
	var baseCompositeStage = stages[3];
	var avgCircleStage = stages[4];
	var probeLayoutStage = stages[5];
	var layoutSampledStage = stages[6];
	var resampledStage = stages[7];
	var groundtruthMapStage = stages[0];
	var virtualSEMStage = stages[8];

	/** called when a change occurs in the spot profile, subregion, or spot content */
	function doUpdate(){
		updateAvgCircle();
		updateProbeLayout();
		updateResamplingSteps(true);
		updateGroundtruthMap();
		updateVirtualSEM_Config();

		// update spot/beam info: size, rotation, shape
		var cellSize = Utils.computeCellSize(probeLayout.image, Utils.getRowsInput(), Utils.getColsInput());
		Utils.updateDisplayBeamParams(baseBeamStage, layoutBeam, cellSize, userScaledImage, promptForSpotWidth);
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
	$(baseBeamStage.getContainer())
		.attr('box_label', 'Spot Profile')
		.attr('note', 'Press [R] to reset shape')
		.css('border-color', 'red');
	// TODO: maybe rename this to something more specific?
	var beam = drawBaseBeam(baseBeamStage);

	// Subregion View
	// draw base image (can pan & zoom)
	$(baseImageStage.getContainer())
		.addClass('grabCursor')
		.attr('box_label', 'Subregion/ROI View')
		.attr('note', 'Pan & Zoom: Drag and Scroll\nPress [R] to reset')
		.css('border-color', 'blue');
	var subregionImage = drawBaseImage(baseImageStage, eImg, G_BoxSize, false, doUpdate);

	// make a clone without copying over the event bindings
	var image = subregionImage.clone().off();

	// draw Spot Content
	$(baseCompositeStage.getContainer())
		.addClass('grabCursor')
		.attr('box_label', 'Spot Content')
		.attr('note', 'Scroll to adjust spot size\nHold [Shift] for half rate');
	var compositeBeam = beam.clone();
	var userScaledImage = drawBaseComposite(baseCompositeStage, image, compositeBeam, doUpdate);

	/**(temporary) publicly exposed function to set the spot width
	 * @param {number} spotWidth the spot width in percent (%), ex. use 130 for 130%.
	 * @todo move into separate file if possible */
	function Utils_SetSpotWidth(spotWidth=100){
		var beam = compositeBeam;
		var userImage = userScaledImage;
		
		// calculate the new scale for spot-content image, based on the given spot width
		var cellSize = Utils.computeCellSize(userImage, Utils.getRowsInput(), Utils.getColsInput());
		var maxScale = Math.max(beam.scaleX(), beam.scaleY());
		var eccScaled = beam.scaleX() / maxScale;
		var newScale = ((beam.width() * eccScaled) / (spotWidth/100)) / cellSize.w;

		// userImage.scale({x: newScale, y: newScale});
		Utils.centeredScale(userImage, newScale);

		// propagate changes and update stages
		updateBeams();
		doUpdate();
	};

	// draw Spot Signal
	$(avgCircleStage.getContainer())
		.addClass('note_colored')
		.attr('box_label', 'Spot Signal');
	var avgCircleBeam = beam.clone();
	var updateAvgCircle = drawAvgCircle(baseCompositeStage, avgCircleStage, avgCircleBeam);

	// draw Spot Layout
	$(probeLayoutStage.getContainer()).attr('box_label', 'Spot Layout');
	var layoutBeam = beam.clone();
	var probeLayout = drawProbeLayout(probeLayoutStage, subregionImage, userScaledImage, layoutBeam);
	var updateProbeLayout = probeLayout.updateCallback;
	
	// draw Sampled Subregion
	// compute resampled image
	$(layoutSampledStage.getContainer()).attr('box_label', 'Sampled Subregion');
	var layoutSampledBeam = beam.clone();
	var updateProbeLayoutSamplingPreview = drawProbeLayoutSampling(
		layoutSampledStage,
		probeLayout.image,
		userScaledImage,
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
		userScaledImage,
		resampledBeam
	);
	
	var updateResamplingSteps = function(internallyCalled){
		var rows = Utils.getRowsInput();
		var cols = Utils.getColsInput();

		if (internallyCalled && (rows*cols > G_AUTO_PREVIEW_LIMIT)) {
			console.warn('automatic preview disable for 64+ grid cells.');
			return;
		}

		updateProbeLayoutSamplingPreview();
		updateResampled();
	};
	G_UpdateResampled = updateResamplingSteps;

	// draw Sample Ground Truth
	$(groundtruthMapStage.getContainer()).attr('box_label', 'Sample Ground Truth');
	var groundtruthMap = drawGroundtruthImage(groundtruthMapStage, eImg, subregionImage, G_BoxSize);
	var updateGroundtruthMap = groundtruthMap.updateFunc;
	
	$(virtualSEMStage.getContainer()).attr('box_label', 'Resulting Image');
	var vitualSEMBeam = beam.clone();
	var updateVirtualSEM_Config = drawVirtualSEM(
		virtualSEMStage,
		vitualSEMBeam,
		groundtruthMap.subregionRect,
		groundtruthMapStage,
		eImg,
		userScaledImage
	);
	G_UpdateVirtualSEMConfig = updateVirtualSEM_Config;

	/** propagate changes to the spot-profile (beam) to the beams in the other stages */
	function updateBeams(){
		compositeBeam.scale(beam.scale());
		compositeBeam.rotation(beam.rotation());
		avgCircleBeam.scale(beam.scale());
		avgCircleBeam.rotation(beam.rotation());

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
		var cc = $('<div/>').addClass('box final').appendTo(G_MainContainer); cc.append(cv);
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
	msg = 'ResampleFullImage End: took '+ Math.floor(Elapsed / 1000).toString()+" seconds.";
	console.log(msg);
	eStatus.innerHTML = msg;
}