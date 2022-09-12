const G_DEBUG = false;

const INPUT_IMAGE = 'src/testimages/grains1b.png';
const COMPOSITE_OP = 'source-in';
// const COMPOSITE_OP = 'destination-in';
var G_UpdateResampled = null;


Konva.autoDrawEnabled = false;


const nStages = 7;
var sz = Math.max((document.body.clientWidth / 4) - (4 * 5), 300);
var mc = $('#main-container');


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

	var StartTime = Date.now();
	console.log('ResampleFullImage Start: '+ (new Date(StartTime)).toString())

	var iw = image.naturalWidth, ih = image.naturalHeight;

	// calculate grid layout
	var pixelSizeX = 10; // px
	var pixelSizeY = 10; // px
	var cols = Math.floor(iw / pixelSizeX);
	var rows = Math.floor(ih / pixelSizeY);

	// cell half width/height
	var cell_half_W = pixelSizeX / 2;
	var cell_half_H = pixelSizeY / 2;

	// spot size ratio
	var spot_rX = 130; // %
	var spot_rY = 130; // % 

	// probe radii
	var probe_rX = pixelSizeX * (spot_rX / 100);
	var probe_rY = pixelSizeY * (spot_rY / 100);
	var probe_rotationRad = 0;

	// prep result canvas
	var cv = document.createElement('canvas');
	cv.width = cols; cv.height = rows;
	var ctx = cv.getContext('2d');

	// process and compute each pixel grid cell
	for (let i = 0; i < rows; i++) {

		// row pixels container array
		var pixels = new Uint8ClampedArray(cols * 4);

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

			// push pixel to array - RGBA values
			pixels[j+0] = pixel;
			pixels[j+1] = pixel;
			pixels[j+2] = pixel;
			pixels[j+3] = 255;
		}

		// draw the image row by row
		let imageData = new ImageData(pixels, cols); // rows/height is auto-calculated
		ctx.putImageData(imageData, 0, i);
		console.log('ResampleFullImage drew row: '+(i+1)+' / '+rows);

		// free memory
		pixels = null;
		imageData = null;
	}

	// open in new window
	var url = cv.toDataURL();
	window.open(url, '_blank');

	var Elapsed = Date.now() - StartTime;
	console.log('ResampleFullImage End: took '+ Math.floor(Elapsed / 1000).toString()+" seconds.");
}