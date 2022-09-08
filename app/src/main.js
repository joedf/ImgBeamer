const INPUT_IMAGE = 'src/testimages/grains1b.png';
const COMPOSITE_OP = 'source-in';
// const COMPOSITE_OP = 'destination-in';
var G_UpdateResampled = null;


Konva.autoDrawEnabled = false;


const nStages = 7;
// var sz = 300;
var sz = (document.body.clientWidth / 4) - (4 * 5);
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

var G_MAIN_GRAIN = null;


function OnImageLoaded(image, beam, stages){

	var doUpdate = function(){
		updateAvgCircle();
		updateProbeLayout();
		G_UpdateResampled(true);
	};

	var s3 = stages[2];
	G_MAIN_GRAIN = drawBaseComposite(s3, image, beam, doUpdate);
	var cc = beam.clone();

	var s4 = stages[3];
	var updateAvgCircle = drawAvgCircle(s3, s4, beam, G_MAIN_GRAIN);

	var s5 = stages[4];
	var updateProbeLayout = drawProbeLayout(s5, G_MAIN_GRAIN_ORIGINAL.clone(), G_MAIN_GRAIN, beam.clone());

	// compute resampled image
	var s6 = stages[5];
	// $(s6.getContainer()).css('border-color', 'lime');
	// prep a canvas and context
	var _imgObj = G_MAIN_GRAIN_ORIGINAL.image();
	var processingStage = createOffscreenStage(_imgObj.naturalWidth, _imgObj.naturalHeight, 2);
	var rImageBase = new Konva.Image({
		x: 0, y: 0, image: _imgObj,
		width: _imgObj.naturalWidth, 
		height: _imgObj.naturalHeight,
	});
	processingStage.getLayers()[0].add(rImageBase);
	rImageBase.cache();


	var s6l = s6.getLayers()[0];
	var s6l2 = new Konva.Layer({listening:false}); s6.add(s6l2);

	var tempFastImg = G_MAIN_GRAIN_ORIGINAL.clone();

	s6.draw();


	var s7 = stages[6];
	$(s7.getContainer()).css('border-color', 'lime');


	G_UpdateResampled = function(internallyCalled){
		var rows = getRowsInput();
		var cols = getColsInput();

		if (internallyCalled && (rows*cols > 64)) {
			console.warn('automatic preview disable for 64+ grid cells.');
			return;
		}

		var grs = G_MAIN_GRAIN; // user-scaled
		var probe = new Konva.Ellipse({
			radius : {
				x : (cc.width() / grs.scaleX()) / 2,
				y : (cc.height() / grs.scaleY()) / 2
			},
			fill: 'white',
			listening: false,
		});

		computeResampledPreview(s6, null, tempFastImg, probe, rows, cols);

		computeResampled(s6, s7, tempFastImg, probe, rows, cols);

		s7.draw();
	}

	doUpdate();
}