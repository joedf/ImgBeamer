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

	var s3 = stages[2];
	var s3l = s3.getLayers()[0];
	var _t = drawBaseComposite(s3, image, beam);
	G_MAIN_GRAIN = _t[0], cc = _t[1];

	var updateAvgCircle = function(){
		var pCtx = s3l.getContext();
		var allPx = pCtx.getImageData(0, 0, pCtx.canvas.width, pCtx.canvas.height);
		var avgPx = get_avg_pixel_rgba(allPx);

		var s4 = stages[3];
		var s4l = s4.getLayers()[0];

		var avgCircle = null;
		if (s4l.getChildren().length <= 0){
			avgCircle = beam.clone();
			s4l.add(avgCircle);
		} else {
			avgCircle = s4l.getChildren()[0];
		}

		var avgColor = "rgba("+ avgPx.join(',') +")";
		avgCircle.stroke(avgColor);
		avgCircle.fill(avgColor);

		s4.getContainer().setAttribute('pixel_value', avgColor);

		s4l.draw();
	};

	G_MAIN_GRAIN.on('mouseup', function() {
		doUpdate();
	});

	G_MAIN_GRAIN.on('dragmove', function() {
		stages[2].draw();
	});

	G_MAIN_GRAIN.on('wheel', function(e){
		// modified from https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html 
		var stage = stages[2];
		var scaleBy = 1.2;

		// stop default scrolling
		e.evt.preventDefault();

		// Do half rate scaling, if shift is pressed
		if (e.evt.shiftKey) {
			scaleBy = 1 +((scaleBy-1) / 2);
		}

		var oldScale = G_MAIN_GRAIN.scaleX();
		var pointer = stage.getPointerPosition();

		var mousePointTo = {
			x: (pointer.x - G_MAIN_GRAIN.x()) / oldScale,
			y: (pointer.y - G_MAIN_GRAIN.y()) / oldScale,
		};

		// how to scale? Zoom in? Or zoom out?
		let direction = e.evt.deltaY > 0 ? -1 : 1;

		var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
		G_MAIN_GRAIN.scale({ x: newScale, y: newScale });

		var newPos = {
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		};
		G_MAIN_GRAIN.position(newPos);

		stage.draw();

		doUpdate();
	});

	// draw bg image for probe layout only once
	var s5 = stages[4];
	var s5l = s5.getLayers()[0];

	var grc = G_MAIN_GRAIN_ORIGINAL.clone();
	s5l.add(grc);
	s5l.draw();

	var updateProbeLayout = function(){
		// draws probe layout

		// get stage layers
		var s5layers = s5.getLayers();

		// get the over-layer, create if not already added
		var s5lg = null;
		var gridDrawn = false;
		if (s5layers.length < 2) {
			s5lg = new Konva.Layer();
			s5.add(s5lg);
		} else {
			s5lg = s5layers[1];
			gridDrawn = true; // assume we drew it already
		}

		// get probe layer, make a new if not already there
		var s5lb = null;
		if (s5layers.length < 3) {
			s5lb = new Konva.Layer();
			s5.add(s5lb);
		} else {
			s5lb = s5layers[2];
		}

		///////////////////////////////
		// Do drawing work ...

		var tRows = getRowsInput();
		var tCols = getColsInput();

		// get the user scaled gr
		var grs = G_MAIN_GRAIN;
		
		// uncomment to draw grid only once
		gridDrawn = false; s5lg.destroyChildren();

		// draw grid on base/source image
		if (!gridDrawn)
			drawGrid(s5lg, grc, tRows, tCols);
		
		// clear the probe layer
		s5lb.destroyChildren();

		var probe = new Konva.Ellipse({
			radius : {
				x : (cc.width() / grs.scaleX()) / 2, //(cell.width/2) * .8,
				y : (cc.height() / grs.scaleY()) / 2 //(cell.height/2) * .8
			},
			fill: 'rgba(255,0,0,.4)',
			strokeWidth: 1,
			stroke: 'red'
		});
		
		repeatDrawOnGrid(s5lb, grc, probe, tRows, tCols);
	}

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

		// probe.globalCompositeOperation(COMPOSITE_OP);
		// probe.globalCompositeOperation("source-over");

		// computeResampled(s6, processingStage, rImageBase, probe, getRowsInput(), getColsInput());
		computeResampledPreview(s6, null, tempFastImg, probe, rows, cols);

		computeResampled(s6, s7, tempFastImg, probe, rows, cols);

		s7.draw();
	}

	var doUpdate = function(){
		updateAvgCircle();
		updateProbeLayout();
		G_UpdateResampled(true);
	};

	doUpdate();
}