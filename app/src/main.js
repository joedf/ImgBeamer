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

loadImage(INPUT_IMAGE, function(event){
	var imageObj = event.target;

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