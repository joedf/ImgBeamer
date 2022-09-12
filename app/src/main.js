var G_DEBUG = false;

const INPUT_IMAGE = 'src/testimages/grains1b.png';
const COMPOSITE_OP = 'source-in';
// const COMPOSITE_OP = 'destination-in';
var G_UpdateResampled = null;

const G_MAIN_CONTAINER = '#main-container';

Konva.autoDrawEnabled = false;


const nStages = 7;
var sz = Math.max((document.body.clientWidth / 4) - (4 * 5), 300);
var mc = $(G_MAIN_CONTAINER);


// first create the stages
var stages = [];
for (let i = 0; i < nStages; i++) {
	var stage = newStageTemplate(mc, sz, sz);
	stages.push(stage);
}

var G_BASE_BEAM = drawBaseBeam(stages[0]);

/////////////////////

var G_MAIN_GRAIN_ORIGINAL = null;
var G_MAIN_IMAGE_OBJ = null

loadImage(INPUT_IMAGE, function(event){
	var imageObj = event.target;
	G_MAIN_IMAGE_OBJ = imageObj;

	G_MAIN_GRAIN_ORIGINAL = drawBaseImage(stages[1], imageObj, sz);
	
	OnImageLoaded(G_MAIN_GRAIN_ORIGINAL, G_BASE_BEAM, stages);
});

function OnImageLoaded(image, beam, stages){

	var doUpdate = function(){
		updateAvgCircle();
		updateProbeLayout();
		updateResamplingSteps(true);
	};

	var s3 = stages[2];
	var userScaledImage = drawBaseComposite(s3, image, beam, doUpdate);

	var s4 = stages[3];
	var updateAvgCircle = drawAvgCircle(s3, s4, beam, userScaledImage);

	var s5 = stages[4];
	var updateProbeLayout = drawProbeLayout(s5, G_MAIN_GRAIN_ORIGINAL.clone(), userScaledImage, beam.clone());

	// compute resampled image
	var s6 = stages[5];
	var updateProbeLayoutSamplingPreview = drawProbeLayoutSampling(s6, G_MAIN_GRAIN_ORIGINAL, userScaledImage, beam);


	var s7 = stages[6];
	$(s7.getContainer()).css('border-color', 'lime');
	var updateResampled = drawResampled(s6, s7, G_MAIN_GRAIN_ORIGINAL, userScaledImage, beam);

	var updateResamplingSteps = function(internallyCalled){
		var rows = getRowsInput();
		var cols = getColsInput();

		if (internallyCalled && (rows*cols > 64)) {
			console.warn('automatic preview disable for 64+ grid cells.');
			return;
		}

		updateProbeLayoutSamplingPreview();
		updateResampled();
	};

	G_UpdateResampled = updateResamplingSteps;

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
	var pixelSizeX = getCellWInput(); // px
	var pixelSizeY = getCellHInput(); // px
	var cols = Math.floor(iw / pixelSizeX);
	var rows = Math.floor(ih / pixelSizeY);

	// cell half width/height
	var cell_half_W = pixelSizeX / 2;
	var cell_half_H = pixelSizeY / 2;

	// spot size ratio
	var spot_rX = getSpotXInput(); // %
	var spot_rY = getSpotYInput(); // % 

	// probe radii
	var probe_rX = pixelSizeX * (spot_rX / 100);
	var probe_rY = pixelSizeY * (spot_rY / 100);
	var probe_rotationRad = toRadians(getSpotAngleInput());

	// prep result canvas, if not already there
	var cv = document.querySelector('#finalCanvas');
	if (cv == null) {
		cv = document.createElement('canvas');
		cv.id = 'finalCanvas';
		cv.width = cols; cv.height = rows;
		var cc = $('<div/>').addClass('box final').appendTo(mc); cc.append(cv);
	}

	cv.width = cols;
	cv.height = rows;

	// get context
	var ctx = cv.getContext('2d');

	// clear the canvas
	ctx.clearRect(0, 0, cv.width, cv.height);

	// row pixels container array
	var pixels = new Uint8ClampedArray(rows * cols * 4);
	count = 0;

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
			const pixel = ComputeProbeValue_gs(image, probe);

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

		/*
		// draw the image row by row
		
		console.log('ResampleFullImage drew row: '+(i+1)+' / '+rows);

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